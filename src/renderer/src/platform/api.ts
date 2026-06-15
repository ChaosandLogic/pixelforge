import type { NetworkInterfaceInfo } from '@shared/messages'

/** Shared network API for Editor and Player renderers. */
export function getNetworkInterfaces(): Promise<NetworkInterfaceInfo[]> {
  if (typeof window.pixelforge !== 'undefined') {
    return window.pixelforge.getNetworkInterfaces()
  }
  if (typeof window.pixelforgePlayer !== 'undefined') {
    return window.pixelforgePlayer.getNetworkInterfaces()
  }
  return Promise.resolve([])
}
