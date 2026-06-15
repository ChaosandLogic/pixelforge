import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { registerAppIpc } from './ipc/app'
import { EngineLauncher } from './engine/EngineLauncher'
import { registerFileIpc } from './ipc/files'
import { registerLicenseIpc } from './ipc/license'
import { registerMediaIpc } from './ipc/media'
import { registerNetworkIpc } from './ipc/network'
import { registerProjectIpc } from './ipc/project'
import { initAutoUpdater } from './updater'
import { initCrashReporting } from './crashReporting'
import { LicenseManager, devBypassEnabled, getDevLicenseStatus } from './licensing/LicenseManager'
import { registerOnboardingIpc } from './ipc/onboarding'
import { setupAppMenu } from './menu'
import { requestLocalNetworkAccess } from './localNetworkPermission'

const engine = new EngineLauncher()
const licenseManager = new LicenseManager('editor')

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0e1116',
    title: 'PixelForge',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  initCrashReporting('editor')
  requestLocalNetworkAccess()
  await licenseManager.init()
  engine.start()
  registerNetworkIpc()
  registerProjectIpc()
  registerMediaIpc()
  registerFileIpc()
  registerLicenseIpc('editor', licenseManager)
  registerOnboardingIpc()
  registerAppIpc()
  setupAppMenu('editor', () =>
    devBypassEnabled() ? getDevLicenseStatus('editor') : licenseManager.getStatus()
  )

  ipcMain.on('engine:request-port', (event) => {
    engine.connectRenderer(event.sender)
  })

  createWindow()
  initAutoUpdater('editor')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  licenseManager.dispose()
  engine.stop()
})
