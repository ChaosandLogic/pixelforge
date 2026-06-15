import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { EngineLauncher } from '../engine/EngineLauncher'
import { bootstrapProjectFromPath } from '../engine/ProjectBootstrap'
import { registerLicenseIpc } from '../ipc/license'
import { registerAppIpc } from '../ipc/app'
import { registerMediaIpc } from '../ipc/media'
import { registerNetworkIpc } from '../ipc/network'
import { registerPlayerProjectIpc } from '../ipc/playerProject'
import { devBypassEnabled, LicenseManager, getDevLicenseStatus } from '../licensing/LicenseManager'
import { initAutoUpdater } from '../updater'
import { initCrashReporting } from '../crashReporting'
import { requestLocalNetworkAccess } from '../localNetworkPermission'
import { setupAppMenu } from '../menu'
import { parsePlayerArgs } from './args'

const engine = new EngineLauncher()
const licenseManager = new LicenseManager('player')
const cli = parsePlayerArgs(process.argv.slice(1))

function createPlayerWindow(): void {
  const win = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 640,
    minHeight: 480,
    show: false,
    backgroundColor: '#0e1116',
    title: 'PixelForge Player',
    webPreferences: {
      preload: join(__dirname, '../preload/player.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const playerUrl = process.env['ELECTRON_RENDERER_URL']
    ? `${process.env['ELECTRON_RENDERER_URL']}/player.html`
    : undefined

  if (playerUrl !== undefined) {
    void win.loadURL(playerUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/player.html'))
  }
}

async function runHeadless(): Promise<void> {
  if (cli.project === null) {
    console.error('Headless mode requires --project /path/to/show.pxf')
    app.exit(1)
    return
  }

  engine.start()
  engine.ensureClientPort()

  engine.onMessage((msg) => {
    if (msg.type === 'status') {
      const s = msg.status
      process.stdout.write(
        `\r[${s.outputActive ? 'ON' : 'OFF'}] ${s.fps.toFixed(1)} fps | ${s.packetsPerSec} pkt/s | ${s.pixelCount} px`
      )
      if (s.outputError !== null) console.error(`\nOutput error: ${s.outputError}`)
      if (s.graphError !== null) console.error(`\nGraph error: ${s.graphError}`)
    }
  })

  try {
    const project = await bootstrapProjectFromPath(engine, cli.project)
    if (cli.iface !== null) {
      engine.sendToEngine({ type: 'set-config', config: { iface: cli.iface } })
    }
    if (cli.output) {
      engine.sendToEngine({ type: 'output-start' })
    }
    console.log(`Running "${project.meta.name}" headless. Press Ctrl+C to stop.`)
  } catch (err) {
    console.error('Failed to load project:', err instanceof Error ? err.message : err)
    app.exit(1)
  }
}

app.whenReady().then(async () => {
  initCrashReporting('player')
  requestLocalNetworkAccess()
  await licenseManager.init()
  registerNetworkIpc()
  registerMediaIpc()
  registerPlayerProjectIpc(engine, () => cli.project)
  registerLicenseIpc('player', licenseManager)
  registerAppIpc()
  setupAppMenu('player', () =>
    devBypassEnabled() ? getDevLicenseStatus('player') : licenseManager.getStatus()
  )

  if (cli.headless) {
    if (!devBypassEnabled() && !(await licenseManager.isUsable())) {
      console.error('Valid Player license required. Activate PixelForge Player first or set PIXELFORGE_DEV_LICENSE=1 for development.')
      app.exit(1)
      return
    }
    await runHeadless()
    return
  }

  engine.start()
  createPlayerWindow()
  initAutoUpdater('player')

  ipcMain.on('engine:request-port', (event) => {
    engine.connectRenderer(event.sender)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createPlayerWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  licenseManager.dispose()
  engine.stop()
})
