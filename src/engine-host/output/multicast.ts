import { createSocket, type Socket } from 'node:dgram'

const SACN_PORT = 5568

export interface MulticastSocket {
  socket: Socket
  /** Resolves when the socket is bound and the multicast interface is set. */
  ready: Promise<void>
}

/**
 * UDP4 socket for outbound sACN multicast.
 * Binds to the egress interface IP, sets multicast interface + TTL after bind.
 */
export function createSacnSocket(multicastIface: string): MulticastSocket {
  const sock = createSocket({ type: 'udp4', reuseAddr: true })

  const ready = new Promise<void>((resolve, reject) => {
    const fail = (err: Error): void => {
      sock.off('listening', onListening)
      reject(err)
    }
    const onListening = (): void => {
      sock.off('error', fail)
      try {
        sock.setMulticastInterface(multicastIface)
        sock.setMulticastTTL(1)
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
        return
      }
      resolve()
    }
    sock.once('error', fail)
    sock.once('listening', onListening)
    sock.bind(0, multicastIface)
  })

  return { socket: sock, ready }
}

export { SACN_PORT }
