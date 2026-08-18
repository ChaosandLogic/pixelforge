import type { Socket } from 'node:dgram'
import { Packet } from 'sacn'
import { dmxChannelsPerUniverse } from '@shared/output/rgbw'
import { createOutboundSocket } from './broadcast'
import { createSacnSocket, SACN_PORT } from './multicast'
import { hasLocalIpv4, isIpv4Host, resolveOutputIface, sacnMulticastAddress } from './networkIface'
import type { OutputProtocol, OutputProtocolConfig } from './OutputProtocol'

const SOURCE_NAME = 'PixelForge'
const MAX_UNIVERSE = 63999

/**
 * sACN (E1.31). Chunks the flat channel stream every 510 (RGB) or 512
 * (RGBW) channels into consecutive universes from startUniverse.
 *
 * Multicast mode (default): each universe goes to 239.255.{hi}.{lo} per the
 * spec — universe 1 is always 239.255.0.1:5568, not a configurable address.
 *
 * Unicast mode: set sacnHost to a fixture IP to send directly there instead.
 */
export class SacnProtocol implements OutputProtocol {
  readonly name = 'sACN'
  private socket: Socket | null = null
  private socketReady: Promise<void> = Promise.resolve()
  private egressIface: string | undefined
  private unicastHost: string | undefined
  private useMulticast = true
  private configKey = ''
  private startUniverse = 1
  private channelsPerUniverse = 510
  private readonly sequences = new Map<number, number>()

  configure(config: OutputProtocolConfig): void {
    const host = config.sacnHost?.trim()
    const unicast = host !== undefined && host.length > 0 && isIpv4Host(host)
    this.useMulticast = !unicast
    this.unicastHost = unicast ? host : undefined

    let resolved = resolveOutputIface(config.iface)
    if (config.iface !== undefined && config.iface.length > 0 && !hasLocalIpv4(config.iface)) {
      resolved = resolveOutputIface(undefined)
    }

    const key = `${resolved ?? ''}|${unicast ? host : 'multicast'}`
    if (key !== this.configKey || this.socket === null) {
      this.recreateSocket(resolved)
      this.configKey = key
    }
    this.startUniverse = config.startUniverse
    this.channelsPerUniverse = dmxChannelsPerUniverse(config.colorMode ?? 'rgb')
  }

  async send(stream: Uint8Array): Promise<number> {
    const sock = this.socket
    if (sock === null) {
      throw new Error('No network interface available for sACN output')
    }

    try {
      await this.socketReady
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`sACN socket setup failed: ${msg}`)
    }

    let packets = 0
    const sends: Promise<void>[] = []

    const chunkSize = this.channelsPerUniverse
    for (let offset = 0, u = 0; offset < stream.length; offset += chunkSize, u++) {
      const universe = this.startUniverse + u
      if (universe > MAX_UNIVERSE) break
      const chunk = stream.subarray(offset, Math.min(offset + chunkSize, stream.length))
      const payload: Record<number, number> = {}
      for (let i = 0; i < chunk.length; i++) {
        payload[i + 1] = chunk[i] as number
      }

      const sequence = this.sequences.get(universe) ?? 0
      this.sequences.set(universe, (sequence + 1) % 256)
      const dest = this.destinationFor(universe)
      const { buffer } = new Packet({
        universe,
        sequence,
        payload,
        sourceName: SOURCE_NAME,
        priority: 100,
        useRawDmxValues: true
      })

      sends.push(
        new Promise((resolve, reject) => {
          sock.send(buffer, SACN_PORT, dest, (err) => {
            if (err !== null) reject(this.wrapSendError(err, universe, dest))
            else resolve()
          })
        })
      )
      packets++
    }

    await Promise.all(sends)
    return packets
  }

  close(): void {
    this.closeSocket()
  }

  private destinationFor(universe: number): string {
    if (!this.useMulticast && this.unicastHost !== undefined) return this.unicastHost
    return sacnMulticastAddress(universe)
  }

  private wrapSendError(err: Error, universe: number, dest: string): Error {
    if (!err.message.includes('EHOSTUNREACH')) return err

    if (this.useMulticast) {
      return new Error(
        `send EHOSTUNREACH ${dest}:${SACN_PORT} — sACN universe ${universe} uses multicast ` +
          `${sacnMulticastAddress(universe)} by spec. On macOS, allow Local Network access for ` +
          `PixelForge (System Settings → Privacy → Local Network), pick your LAN adapter (${this.egressIface ?? 'none'}) in Network, ` +
          `or set a fixture IP in the Pixel Output node for unicast sACN.`
      )
    }

    return new Error(
      `send EHOSTUNREACH ${dest}:${SACN_PORT} — check the fixture IP and Network interface selection.`
    )
  }

  private recreateSocket(multicastIface: string | undefined): void {
    this.closeSocket()
    if (multicastIface === undefined) return

    if (this.useMulticast) {
      const { socket, ready } = createSacnSocket(multicastIface)
      socket.on('error', () => {})
      this.socket = socket
      this.socketReady = ready
    } else {
      const { socket, ready } = createOutboundSocket()
      socket.on('error', () => {})
      this.socket = socket
      this.socketReady = ready
    }

    this.egressIface = multicastIface
    this.sequences.clear()
  }

  private closeSocket(): void {
    if (this.socket !== null) {
      this.socket.close()
      this.socket = null
      this.socketReady = Promise.resolve()
      this.egressIface = undefined
      this.configKey = ''
    }
  }
}
