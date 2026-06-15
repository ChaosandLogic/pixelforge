import { createSocket, type Socket } from 'node:dgram'
import os from 'node:os'

const GLOBAL_BROADCAST = '255.255.255.255'

/** Subnet-directed broadcast for an IPv4 interface, or global broadcast. */
export function broadcastDestination(localIp: string | undefined, targetHost: string): string {
  if (targetHost !== GLOBAL_BROADCAST) return targetHost
  if (localIp === undefined) return GLOBAL_BROADCAST

  for (const infos of Object.values(os.networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family === 'IPv4' && info.address === localIp) {
        return ipv4Broadcast(info.address, info.netmask)
      }
    }
  }
  return GLOBAL_BROADCAST
}

function ipv4Broadcast(address: string, netmask: string): string {
  const ip = address.split('.').map((p) => Number(p))
  const mask = netmask.split('.').map((p) => Number(p))
  if (ip.length !== 4 || mask.length !== 4) return GLOBAL_BROADCAST
  return ip.map((octet, i) => octet | (~(mask[i] as number) & 0xff)).join('.')
}

export interface OutboundSocket {
  socket: Socket
  /** Resolves when the socket is bound and broadcast is enabled. */
  ready: Promise<void>
}

/**
 * Create a UDP4 socket bound to 0.0.0.0 for outbound traffic.
 * setBroadcast runs after bind completes — calling it synchronously after
 * bind() throws EBADF on macOS.
 */
export function createOutboundSocket(): OutboundSocket {
  const sock = createSocket({ type: 'udp4' })

  const ready = new Promise<void>((resolve, reject) => {
    const fail = (err: Error): void => {
      sock.off('listening', onListening)
      reject(err)
    }
    const onListening = (): void => {
      sock.off('error', fail)
      try {
        sock.setBroadcast(true)
      } catch {
        // Subnet-directed broadcast often works without SO_BROADCAST.
      }
      resolve()
    }
    sock.once('error', fail)
    sock.once('listening', onListening)
    sock.bind(0, '0.0.0.0')
  })

  return { socket: sock, ready }
}
