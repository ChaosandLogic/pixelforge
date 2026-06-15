import { createSocket } from 'node:dgram'

/**
 * Trigger macOS Local Network permission (macOS 11+, required on 15+ for LAN UDP).
 * Sends a throwaway mDNS probe from the main app so TCC attributes access correctly.
 */
export function requestLocalNetworkAccess(): void {
  if (process.platform !== 'darwin') return

  const sock = createSocket('udp4')
  sock.on('error', () => {
    sock.close()
  })
  sock.bind(0, () => {
    sock.send(Buffer.from([0]), 5353, '224.0.0.251', () => {
      sock.close()
    })
  })
}
