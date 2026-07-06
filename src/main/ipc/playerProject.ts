import { ipcMain } from 'electron'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ProjectFile } from '@shared/project'
import type { EngineLauncher } from '../engine/EngineLauncher'
import { loadProjectFile } from '../engine/ProjectBootstrap'
import { resolveShowRelativePath } from '../player/showPath'

export function registerPlayerProjectIpc(
  engine: EngineLauncher,
  getCliProjectPath: () => string | null
): void {
  ipcMain.handle('player:load-initial', async (): Promise<ProjectFile | null> => {
    const path = getCliProjectPath()
    if (path === null || !existsSync(resolve(path))) return null
    return loadProjectFile(path)
  })

  ipcMain.handle('player:open-project', async (): Promise<ProjectFile | null> => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      title: 'Open Show',
      properties: ['openFile'],
      filters: [{ name: 'PixelForge Project', extensions: ['pxf'] }]
    })
    const filePath = result.filePaths[0]
    if (result.canceled || filePath === undefined) return null
    return loadProjectFile(filePath)
  })

  ipcMain.handle('player:read-project', async (_event, path: string): Promise<ProjectFile> => {
    if (!existsSync(resolve(path))) throw new Error('Project file not found')
    return loadProjectFile(path)
  })

  ipcMain.handle('player:read-show-manifest', async (_event, showDir: string): Promise<ProjectFile> => {
    const manifestPath = resolve(showDir, 'show.json')
    if (!existsSync(manifestPath)) throw new Error('show.json not found in show folder')
    const raw: unknown = JSON.parse(await readFile(manifestPath, 'utf-8'))
    const manifest = raw as { project?: string }
    const projectPath = resolveShowRelativePath(showDir, manifest.project ?? 'show.pxf')
    return loadProjectFile(projectPath)
  })

  ipcMain.handle('player:start-output', (): void => {
    engine.sendToEngine({ type: 'output-start' })
  })

  ipcMain.handle('player:stop-output', (): void => {
    engine.sendToEngine({ type: 'output-stop' })
  })

  ipcMain.handle('player:set-config', (_event, config: { iface?: string | null }): void => {
    engine.sendToEngine({ type: 'set-config', config })
  })
}
