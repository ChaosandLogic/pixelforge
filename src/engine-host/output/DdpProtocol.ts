import type { Socket } from 'node:dgram'
import { createOutboundSocket, broadcastDestination } from './broadcast'
import { resolveOutputIface } from './networkIface'
import type { OutputProtocol, OutputProtocolConfig } from './OutputProtocol'

/** Safe UDP payload size for DDP frames (typical MTU headroom). */
const MAX_DDP_DATA = 1440
const DDP_HEADER = 10
const DDP_TYPE_RGB = 0x01
const DDP_TYPE_RGBW = 0x03

/**
 * Distributed Display Protocol (DDP) — RGB / RGBW push packets with a
 * byte offset into the logical channel stream. No universe limit.
 */
export class DdpProtocol implements OutputProtocol {
  readonly name = 'DDP'
  private socket: Socket | null = null
  private socketReady: Promise<void> = Promise.resolve()
  private iface: string | undefined
  private host = '255.255.255.255'
  private port = 4048
  private dataType = DDP_TYPE_RGB
  private sequence = 0

  configure(config: OutputProtocolConfig): void {
    const hostChanged = config.ddpHost !== this.host
    const portChanged = config.ddpPort !== this.port
    const ifaceChanged = config.iface !== this.iface
    this.iface = config.iface
    this.host = broadcastDestination(resolveOutputIface(config.iface), config.ddpHost ?? '255.255.255.255')
    this.port = config.ddpPort ?? 4048
    this.dataType = config.colorMode === 'rgbw' ? DDP_TYPE_RGBW : DDP_TYPE_RGB

    if (hostChanged || portChanged || ifaceChanged || this.socket === null) {
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

    for (let offset = 0; offset < stream.length; offset += MAX_DDP_DATA) {
      const chunk = stream.subarray(offset, Math.min(offset + MAX_DDP_DATA, stream.length))
      const packet = buildDdpPacket(offset, chunk, this.sequence, this.dataType)
      this.sequence = (this.sequence + 1) & 0xff
      sends.push(
        new Promise((resolve, reject) => {
          sock.send(packet, 0, packet.length, this.port, this.host, (err) => {
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

function buildDdpPacket(dataOffset: number, data: Uint8Array, sequence: number, dataType: number): Buffer {
  const buf = Buffer.alloc(DDP_HEADER + data.length)
  buf[0] = 0x41 // push + storage
  buf[1] = sequence & 0xff
  buf[2] = dataType
  buf.writeUInt32BE(dataOffset, 3)
  buf.writeUInt16BE(data.length, 7)
  Buffer.from(data).copy(buf, DDP_HEADER)
  return buf
}
