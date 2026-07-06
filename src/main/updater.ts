import { autoUpdater } from 'electron-updater'
import { app, dialog } from 'electron'
import type { Product } from '@shared/appInfo'

export function initAutoUpdater(product: Product): void {
  if (!app.isPackaged) return
  if (process.env['PIXELFORGE_SKIP_UPDATER'] === '1') return

  autoUpdater.autoDownload = false
  autoUpdater.channel = product

  autoUpdater.on('update-available', () => {
    void dialog
      .showMessageBox({
        type: 'info',
        title: 'Update available',
        message: 'A new version of PixelForge is available. Download now?',
        buttons: ['Download', 'Later']
      })
      .then((result) => {
        if (result.response === 0) void autoUpdater.downloadUpdate()
      })
  })

  autoUpdater.on('update-downloaded', () => {
    void dialog
      .showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: 'Restart to install the update?',
        buttons: ['Restart', 'Later']
      })
      .then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall()
      })
  })

  void autoUpdater.checkForUpdates()
}
