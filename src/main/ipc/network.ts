import { ipcMain } from 'electron'
import os from 'node:os'
import type { NetworkInterfaceInfo } from '@shared/messages'

export function registerNetworkIpc(): void {
  ipcMain.handle('network:interfaces', (): NetworkInterfaceInfo[] => {
    const result: NetworkInterfaceInfo[] = []
    for (const [name, infos] of Object.entries(os.networkInterfaces())) {
      for (const info of infos ?? []) {
        if (info.family === 'IPv4') {
          result.push({ name, address: info.address, internal: info.internal })
        }
      }
    }
    return result
  })
}
