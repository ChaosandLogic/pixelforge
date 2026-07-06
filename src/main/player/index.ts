import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type { ProjectFile } from '@shared/project'
import type { StartupPlan } from '@shared/playerStartup'
import { EngineLauncher } from '../engine/EngineLauncher'
import { bootstrapProjectFromPath } from '../engine/ProjectBootstrap'
import { registerAppIpc } from '../ipc/app'
import { registerMediaIpc } from '../ipc/media'
import { registerNetworkIpc } from '../ipc/network'
import { registerPlayerProjectIpc } from '../ipc/playerProject'
import { registerPlayerStartupIpc } from '../ipc/playerStartup'
import { initAutoUpdater } from '../updater'
import { initCrashReporting } from '../crashReporting'
import { requestLocalNetworkAccess } from '../localNetworkPermission'
import { setupAppMenu } from '../menu'
import { parsePlayerArgs } from './args'
import { readShowStartupHints } from './showPath'
import { syncLoginItem } from './loginItem'
import { readPlayerStartupConfig } from './startupConfig'
import { resolveStartupPlan, validateStartupPlan } from './startupPlan'

const engine = new EngineLauncher()
const cli = parsePlayerArgs(process.argv.slice(1))

// Packaged builds get their icon from electron-builder; this only dresses up the
// dev window/dock so `npm run dev:player` doesn't show the default Electron icon.
const devIconPath = join(__dirname, '../../build/icon-player.png')

process.on('unhandledRejection', (reason) => {
  console.error('[player] Unhandled promise rejection:', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[player] Uncaught exception:', err)
})

let bootProjectPath: string | null = null
let bootProject: ProjectFile | null = null
let bootPlan: StartupPlan | null = null

function createPlayerWindow(): void {
  const win = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 640,
    minHeight: 480,
    show: false,
    backgroundColor: '#0e1116',
    title: 'PixelForge Player',
    ...(app.isPackaged ? {} : { icon: devIconPath }),
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

async function applyPlanToEngine(plan: StartupPlan): Promise<ProjectFile | null> {
  if (plan.projectPath === null) return null
  validateStartupPlan(plan)
  const project = await bootstrapProjectFromPath(engine, plan.projectPath)
  if (plan.interface !== null) {
    engine.sendToEngine({ type: 'set-config', config: { iface: plan.interface } })
  }
  if (plan.autoOutput) {
    engine.sendToEngine({ type: 'output-start' })
  }
  bootProjectPath = plan.projectPath
  bootProject = project
  bootPlan = plan
  return project
}

async function runHeadless(plan: StartupPlan): Promise<void> {
  if (plan.projectPath === null) {
    console.error('Headless mode requires a show path. Use --project, --show-dir, or configure Startup Show in Player settings.')
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
    const project = await applyPlanToEngine(plan)
    console.log(`Running "${project!.meta.name}" headless. Press Ctrl+C to stop.`)
  } catch (err) {
    console.error('Failed to load project:', err instanceof Error ? err.message : err)
    app.exit(1)
  }
}

async function resolveBootPlan(): Promise<StartupPlan> {
  const saved = await readPlayerStartupConfig()
  let showHints = null
  if (cli.showDir !== null) {
    showHints = readShowStartupHints(cli.showDir)
  } else if (saved.showPath !== null && saved.showPathKind === 'show-folder') {
    showHints = readShowStartupHints(saved.showPath)
  }
  const plan = resolveStartupPlan({ cli, saved, showHints })
  return plan
}

app.whenReady().then(async () => {
  initCrashReporting('player')
  if (!app.isPackaged && process.platform === 'darwin') app.dock?.setIcon(devIconPath)
  requestLocalNetworkAccess()

  const saved = await readPlayerStartupConfig()
  syncLoginItem(saved)

  const plan = await resolveBootPlan()

  registerNetworkIpc()
  registerMediaIpc()
  registerPlayerProjectIpc(engine, () => bootProjectPath)
  registerPlayerStartupIpc(engine, {
    getBootProject: () => bootProject,
    getBootPlan: () => bootPlan,
    applyPlan: applyPlanToEngine
  })
  registerAppIpc()
  setupAppMenu('player')

  if (plan.headless) {
    await runHeadless(plan)
    return
  }

  engine.start()

  if (plan.projectPath !== null) {
    try {
      await applyPlanToEngine(plan)
    } catch (err) {
      console.error('Failed to load startup show:', err instanceof Error ? err.message : err)
    }
  }

  createPlayerWindow()
  initAutoUpdater('player')

  ipcMain.on('engine:request-port', (event) => {
    engine.connectRenderer(event.sender)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createPlayerWindow()
  })
}).catch((err: unknown) => {
  console.error('[player] Fatal error during startup:', err)
  app.exit(1)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  engine.stop()
})
