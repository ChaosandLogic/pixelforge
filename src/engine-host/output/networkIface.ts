import os from 'node:os'

/** sACN multicast destination for a universe (ANSI E1.31). Universe 1 → 239.255.0.1. */
export function sacnMulticastAddress(universe: number): string {
  if (universe <= 0 || universe > 63999) {
    throw new RangeError('universe must be between 1-63999')
  }
  return `239.255.${universe >> 8}.${universe & 255}`
}

const PREFERRED_IFACE_NAMES = ['en0', 'en1', 'wlan0', 'eth0']

export function isIpv4Host(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  return parts.every((p) => {
    const n = Number(p)
    return Number.isInteger(n) && n >= 0 && n <= 255
  })
}

/**
 * Resolve the IPv4 address used for outbound multicast/broadcast.
 * macOS requires an explicit interface for 239.x — "system default" is unreliable.
 */
export function resolveOutputIface(preferred?: string): string | undefined {
  if (preferred !== undefined && preferred.length > 0) {
    return preferred
  }

  const candidates: Array<{ name: string; address: string }> = []
  for (const [name, infos] of Object.entries(os.networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family === 'IPv4' && !info.internal) {
        candidates.push({ name, address: info.address })
      }
    }
  }

  for (const preferredName of PREFERRED_IFACE_NAMES) {
    const match = candidates.find((c) => c.name === preferredName)
    if (match !== undefined) return match.address
  }

  return candidates[0]?.address
}

/** Whether the given IPv4 address exists on this machine. */
export function hasLocalIpv4(address: string): boolean {
  for (const infos of Object.values(os.networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family === 'IPv4' && info.address === address) return true
    }
  }
  return false
}
