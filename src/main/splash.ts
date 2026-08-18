import { BrowserWindow, app } from 'electron'
import { join } from 'node:path'
import type { Product } from '@shared/appInfo'

const SPLASH_TIMEOUT_MS = 15_000
const splashWindows = new WeakSet<BrowserWindow>()

/** Compact frameless splash shown until the main window is ready. */
export function createSplashWindow(product: Product): BrowserWindow {
  const splash = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: true,
    backgroundColor: '#0a0d12',
    hasShadow: true,
    roundedCorners: true,
    title: product === 'player' ? 'PixelForge Player' : 'PixelForge',
    webPreferences: {
      sandbox: true,
      contextIsolation: true
    }
  })
  splashWindows.add(splash)
  splash.setMenu(null)

  const query = { product }
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl !== undefined) {
    void splash.loadURL(`${devUrl}/splash.html?product=${product}`)
  } else {
    void splash.loadFile(join(__dirname, '../renderer/splash.html'), { query })
  }

  return splash
}

/** True when an Editor/Player window exists (ignores the splash). */
export function hasAppWindow(): boolean {
  return BrowserWindow.getAllWindows().some((win) => !win.isDestroyed() && !splashWindows.has(win))
}

/** Show the main window, then close the splash. Safe if splash already closed. */
export function handoffSplash(main: BrowserWindow, splash: BrowserWindow | null): void {
  const closeSplash = (): void => {
    if (splash !== null && !splash.isDestroyed()) splash.close()
  }

  const reveal = (): void => {
    if (!main.isDestroyed() && !main.isVisible()) main.show()
    closeSplash()
  }

  const timer = setTimeout(reveal, SPLASH_TIMEOUT_MS)
  main.once('ready-to-show', () => {
    clearTimeout(timer)
    reveal()
  })
  main.once('closed', closeSplash)

  if (app.isPackaged === false && splash !== null) {
    splash.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'Escape') closeSplash()
    })
  }
}
