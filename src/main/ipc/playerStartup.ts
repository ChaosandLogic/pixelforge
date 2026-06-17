import { BrowserWindow, dialog, ipcMain } from 'electron'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ProjectFile } from '@shared/project'
import {
  isStartupConfigReadyForLogin,
  type PlayerStartupConfig,
  type ShowStartupHints,
  type StartupPlan
} from '@shared/playerStartup'
import type { EngineLauncher } from '../engine/EngineLauncher'
import { getLoginItemStatus, syncLoginItem } from '../player/loginItem'
import { resolveStartupPlan, validateStartupPlan } from '../player/startupPlan'
import { detectShowPathKind, readShowStartupHints, resolveShowProjectPath } from '../player/showPath'
import { readPlayerStartupConfig, writePlayerStartupConfig } from '../player/startupConfig'

export interface PlayerStartupContext {
  getBootProject: () => ProjectFile | null
  getBootPlan: () => StartupPlan | null
  applyPlan: (plan: StartupPlan) => Promise<ProjectFile | null>
}

export function registerPlayerStartupIpc(
  engine: EngineLauncher,
  ctx: PlayerStartupContext
): void {
  ipcMain.handle('player:get-startup-config', async (): Promise<PlayerStartupConfig> => {
    return readPlayerStartupConfig()
  })

  ipcMain.handle(
    'player:set-startup-config',
    async (_event, config: PlayerStartupConfig): Promise<{ ok: boolean; error?: string }> => {
      if (config.launchAtLogin && !isStartupConfigReadyForLogin(config)) {
        return {
          ok: false,
          error: 'Choose a show and windowed or headless mode before enabling launch at login.'
        }
      }
      if (config.showPath !== null) {
        try {
          resolveShowProjectPath(config.showPath, config.showPathKind)
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : 'Show path is invalid'
          }
        }
      }
      await writePlayerStartupConfig(config)
      syncLoginItem(config)
      return { ok: true }
    }
  )

  ipcMain.handle('player:pick-show', async (): Promise<{ path: string; kind: 'project' | 'show-folder' } | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select Show',
      properties: ['openFile', 'openDirectory'],
      filters: [{ name: 'PixelForge Project', extensions: ['pxf'] }]
    })
    const picked = result.filePaths[0]
    if (result.canceled || picked === undefined) return null
    const kind = detectShowPathKind(picked)
    if (kind === 'show-folder') {
      const manifestPath = resolve(picked, 'show.json')
      if (!existsSync(manifestPath)) {
        throw new Error('Selected folder is not a show export (show.json missing)')
      }
    }
    return { path: picked, kind }
  })

  ipcMain.handle('player:read-show-hints', async (_event, showDir: string): Promise<ShowStartupHints | null> => {
    return readShowStartupHints(showDir)
  })

  ipcMain.handle('player:get-login-item-status', async (): Promise<ReturnType<typeof getLoginItemStatus>> => {
    const config = await readPlayerStartupConfig()
    return getLoginItemStatus(config)
  })

  ipcMain.handle('player:get-boot-status', async (): Promise<{
    project: ProjectFile | null
    autoOutput: boolean
  }> => {
    const plan = ctx.getBootPlan()
    return {
      project: ctx.getBootProject(),
      autoOutput: plan?.autoOutput ?? false
    }
  })

  ipcMain.handle('player:apply-startup-now', async (): Promise<{ ok: boolean; project?: ProjectFile; error?: string }> => {
    const saved = await readPlayerStartupConfig()
    let showHints: ShowStartupHints | null = null
    if (saved.showPath !== null && saved.showPathKind === 'show-folder') {
      showHints = readShowStartupHints(saved.showPath)
    }
    const plan = resolveStartupPlan({
      cli: {
        project: null,
        showDir: null,
        iface: null,
        headless: false,
        headlessExplicit: false,
        autoOutput: false,
        autoOutputExplicit: false,
        noOutput: false
      },
      saved,
      showHints
    })
    try {
      validateStartupPlan(plan)
      const project = await ctx.applyPlan(plan)
      if (project === null) {
        return { ok: false, error: 'No show configured' }
      }
      return { ok: true, project }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to apply startup show' }
    }
  })

  ipcMain.handle('player:open-startup-panel', (): void => {
    const win = BrowserWindow.getAllWindows()[0]
    win?.webContents.send('player:show-startup-panel')
  })

  void engine
}
