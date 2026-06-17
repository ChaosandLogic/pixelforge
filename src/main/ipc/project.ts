import { app, dialog, ipcMain } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { migrateProjectFile, type ExampleManifestEntry, type ProjectFile } from '@shared/project'
import { exportShowBundle } from '../export/showExport'
import type { ShowManifest } from '@shared/showExportTypes'
import type { ShowStartupHints } from '@shared/playerStartup'

let lastProjectPath: string | null = null

function examplesDir(): string {
  const candidates = [
    join(process.cwd(), 'examples'),
    join(app.getAppPath(), 'examples'),
    join(__dirname, '../../examples'),
    join(__dirname, '../../../examples')
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }
  return join(process.cwd(), 'examples')
}

export function registerProjectIpc(): void {
  ipcMain.handle('project:save', async (_event, project: ProjectFile): Promise<string | null> => {
    const result = await dialog.showSaveDialog({
      title: 'Save Project',
      defaultPath: `${project.meta.name || 'untitled'}.pxf`,
      filters: [{ name: 'PixelForge Project', extensions: ['pxf'] }]
    })
    if (result.canceled || result.filePath === undefined) return null
    await writeFile(result.filePath, JSON.stringify(project, null, 2), 'utf-8')
    lastProjectPath = result.filePath
    return result.filePath
  })

  ipcMain.handle('project:list-examples', async (): Promise<ExampleManifestEntry[]> => {
    const dir = examplesDir()
    const manifestPath = join(dir, 'manifest.json')
    if (!existsSync(manifestPath)) return []
    const raw: unknown = JSON.parse(await readFile(manifestPath, 'utf-8'))
    return Array.isArray(raw) ? (raw as ExampleManifestEntry[]) : []
  })

  ipcMain.handle('project:open-example', async (_event, filename: string): Promise<ProjectFile | null> => {
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) return null
    const path = join(examplesDir(), filename)
    if (!existsSync(path)) return null
    const raw: unknown = JSON.parse(await readFile(path, 'utf-8'))
    return migrateProjectFile(raw)
  })

  ipcMain.handle('project:open', async (): Promise<ProjectFile | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Open Project',
      properties: ['openFile'],
      filters: [{ name: 'PixelForge Project', extensions: ['pxf'] }]
    })
    const path = result.filePaths[0]
    if (result.canceled || path === undefined) return null
    const raw: unknown = JSON.parse(await readFile(path, 'utf-8'))
    lastProjectPath = path
    return migrateProjectFile(raw)
  })

  ipcMain.handle(
    'project:export-show',
    async (
      _event,
      project: ProjectFile,
      startup?: ShowStartupHints
    ): Promise<{ outputDir: string; manifest: ShowManifest } | null> => {
      const dirResult = await dialog.showOpenDialog({
        title: 'Export Show for Player',
        properties: ['openDirectory', 'createDirectory']
      })
      const outputDir = dirResult.filePaths[0]
      if (dirResult.canceled || outputDir === undefined) return null

      let sourcePath = lastProjectPath
      if (sourcePath === null) {
        const fileResult = await dialog.showOpenDialog({
          title: 'Select source project file (for media paths)',
          properties: ['openFile'],
          filters: [{ name: 'PixelForge Project', extensions: ['pxf'] }]
        })
        sourcePath = fileResult.filePaths[0] ?? null
      }
      if (sourcePath === null) sourcePath = join(outputDir, 'show.pxf')

      const manifest = await exportShowBundle(project, sourcePath, outputDir, startup)
      return { outputDir, manifest }
    }
  )
}
