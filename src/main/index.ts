import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { registerAppIpc } from './ipc/app'
import { EngineLauncher } from './engine/EngineLauncher'
import { registerFileIpc } from './ipc/files'
import { registerMediaIpc } from './ipc/media'
import { registerNetworkIpc } from './ipc/network'
import { registerProjectIpc } from './ipc/project'
import { initAutoUpdater } from './updater'
import { initCrashReporting } from './crashReporting'
import { registerOnboardingIpc } from './ipc/onboarding'
import { setupAppMenu } from './menu'
import { requestLocalNetworkAccess } from './localNetworkPermission'

const engine = new EngineLauncher()

// Packaged builds get their icon from electron-builder; this only dresses up the
// dev window/dock so `npm run dev` doesn't show the default Electron icon.
const devIconPath = join(__dirname, '../../build/icon.png')

process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled promise rejection:', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught exception:', err)
})

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0e1116',
    title: 'PixelForge',
    ...(app.isPackaged ? {} : { icon: devIconPath }),
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
  if (!app.isPackaged && process.platform === 'darwin') app.dock?.setIcon(devIconPath)
  requestLocalNetworkAccess()
  engine.start()
  registerNetworkIpc()
  registerProjectIpc()
  registerMediaIpc()
  registerFileIpc()
  registerOnboardingIpc()
  registerAppIpc()
  setupAppMenu('editor')

  ipcMain.on('engine:request-port', (event) => {
    engine.connectRenderer(event.sender)
  })

  createWindow()
  initAutoUpdater('editor')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch((err: unknown) => {
  console.error('[main] Fatal error during startup:', err)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  engine.stop()
})
