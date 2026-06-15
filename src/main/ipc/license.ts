import { ipcMain } from 'electron'
import type { LicenseProduct } from '@shared/licensing/types'
import { devBypassEnabled, getDevLicenseStatus, LicenseManager } from '../licensing/LicenseManager'
import { refreshAppMenu } from '../menu'

export function registerLicenseIpc(product: LicenseProduct, manager: LicenseManager): void {
  ipcMain.handle('license:status', async () => {
    if (devBypassEnabled()) return getDevLicenseStatus(product)
    return manager.getStatus()
  })

  ipcMain.handle('license:activate', async (_event, licenseKey: string, email: string) => {
    if (devBypassEnabled()) return getDevLicenseStatus(product)
    const status = await manager.activate(licenseKey, email)
    refreshAppMenu()
    return status
  })

  ipcMain.handle('license:deactivate', async () => {
    if (devBypassEnabled()) return
    await manager.deactivate()
    refreshAppMenu()
  })

  ipcMain.handle('license:is-usable', async () => {
    if (devBypassEnabled()) return true
    return manager.isUsable()
  })
}
