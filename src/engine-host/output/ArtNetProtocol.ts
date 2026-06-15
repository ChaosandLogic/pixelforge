import type { Socket } from 'node:dgram'
import { CHANNELS_PER_UNIVERSE } from '@shared/patch/types'
import { createOutboundSocket, broadcastDestination } from './broadcast'
import { resolveOutputIface } from './networkIface'
import type { OutputProtocol, OutputProtocolConfig } from './OutputProtocol'

const ARTNET_PORT = 6454
const MAX_UNIVERSE = 32768

/**
 * Art-Net ArtDmx (OpOutput / 0x5000). Chunks the flat RGB stream every
 * 510 channels into consecutive universes from startUniverse (mapped to
 * 0-based Art-Net port addresses).
 */
export class ArtNetProtocol implements OutputProtocol {
  readonly name = 'Art-Net'
  private socket: Socket | null = null
  private socketReady: Promise<void> = Promise.resolve()
  private iface: string | undefined
  private destHost = '255.255.255.255'
  private startUniverse = 1
  private sequence = 0

  configure(config: OutputProtocolConfig): void {
    const ifaceChanged = config.iface !== this.iface
    this.iface = config.iface
    this.startUniverse = config.startUniverse
    this.destHost = broadcastDestination(resolveOutputIface(config.iface), '255.255.255.255')

    if (ifaceChanged || this.socket === null) {
      this.closeSocket()
      const { socket, ready } = createOutboundSocket()
      socket.on('error', () => {})
      this.socket = socket
      this.socketReady = ready
    }
  }

  async send(stream: Uint8Array): Promise<number> {
    const sock = this.socket
    if (sock === null) return 0
    try {
      await this.socketReady
    } catch {
      return 0
    }

    let packets = 0
    const sends: Promise<void>[] = []

    for (let offset = 0, u = 0; offset < stream.length; offset += CHANNELS_PER_UNIVERSE, u++) {
      const universeIndex = this.startUniverse - 1 + u
      if (universeIndex >= MAX_UNIVERSE) break
      const chunk = stream.subarray(offset, Math.min(offset + CHANNELS_PER_UNIVERSE, stream.length))
      const packet = buildArtDmx(universeIndex, chunk, this.sequence)
      this.sequence = (this.sequence + 1) & 0xff
      sends.push(
        new Promise((resolve, reject) => {
          sock.send(packet, 0, packet.length, ARTNET_PORT, this.destHost, (err) => {
            if (err !== null) reject(err)
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

  private closeSocket(): void {
    if (this.socket !== null) {
      this.socket.close()
      this.socket = null
      this.socketReady = Promise.resolve()
    }
  }
}

function buildArtDmx(portAddress: number, data: Uint8Array, sequence: number): Buffer {
  const buf = Buffer.alloc(18 + data.length)
  buf.write('Art-Net\0', 0, 'ascii')
  buf.writeUInt16LE(0x5000, 8)
  buf.writeUInt16BE(14, 10)
  buf[12] = sequence & 0xff
  buf[13] = 0
  buf.writeUInt16LE(portAddress & 0x7fff, 14)
  buf.writeUInt16BE(data.length, 16)
  Buffer.from(data).copy(buf, 18)
  return buf
}
