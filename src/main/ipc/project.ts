import { app, dialog, ipcMain } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { migrateProjectFile, type ExampleManifestEntry, type ProjectFile } from '@shared/project'
import { resolveProjectMediaPaths } from '@shared/projectEngineSync'
import { loadProjectFile } from '../engine/ProjectBootstrap'
import { allowGraphMedia, allowMediaRoot } from '../mediaAccess'
import { exportShowBundle } from '../export/showExport'
import { exportEspBundle } from '../export/espExport'
import { exportFseqBundle } from '../export/fseqExport'
import type { ShowManifest } from '@shared/showExportTypes'
import type { EspExportPayload, EspExportResult } from '@shared/espExportTypes'
import type { FseqExportPayload, FseqExportResult } from '@shared/fseqExportTypes'
import type { ShowStartupHints } from '@shared/playerStartup'

let lastProjectPath: string | null = null

async function writeProject(path: string, project: ProjectFile): Promise<string> {
  await writeFile(path, JSON.stringify(project, null, 2), 'utf-8')
  lastProjectPath = path
  return path
}

async function saveProjectDialog(project: ProjectFile): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    title: 'Save Project',
    defaultPath: lastProjectPath ?? `${project.meta.name || 'untitled'}.pxf`,
    filters: [{ name: 'PixelForge Project', extensions: ['pxf'] }]
  })
  if (result.canceled || result.filePath === undefined) return null
  return writeProject(result.filePath, project)
}

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
  ipcMain.handle('project:new', (): void => {
    lastProjectPath = null
  })

  ipcMain.handle('project:save', async (_event, project: ProjectFile): Promise<string | null> => {
    if (lastProjectPath !== null) return writeProject(lastProjectPath, project)
    return saveProjectDialog(project)
  })

  ipcMain.handle('project:save-as', async (_event, project: ProjectFile): Promise<string | null> => {
    return saveProjectDialog(project)
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
    const dir = examplesDir()
    const path = join(dir, filename)
    if (!existsSync(path)) return null
    const raw: unknown = JSON.parse(await readFile(path, 'utf-8'))
    const project = migrateProjectFile(raw)
    // Examples reference bundled media relative to the examples folder.
    const resolved: ProjectFile = { ...project, graph: resolveProjectMediaPaths(project.graph, dir) }
    allowMediaRoot(dir)
    allowGraphMedia(resolved.graph)
    return resolved
  })

  ipcMain.handle('project:open', async (): Promise<ProjectFile | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Open Project',
      properties: ['openFile'],
      filters: [{ name: 'PixelForge Project', extensions: ['pxf'] }]
    })
    const path = result.filePaths[0]
    if (result.canceled || path === undefined) return null
    lastProjectPath = path
    // loadProjectFile migrates, resolves relative media paths against the
    // project directory, and grants the renderer read access to that media.
    return loadProjectFile(path)
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

      try {
        const manifest = await exportShowBundle(project, sourcePath, outputDir, startup)
        return { outputDir, manifest }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[export-show] failed:', err)
        throw new Error(`Show export failed: ${msg}`)
      }
    }
  )

  ipcMain.handle(
    'project:export-esp',
    async (_event, payload: EspExportPayload): Promise<EspExportResult | null> => {
      const dirResult = await dialog.showOpenDialog({
        title: 'Export Show for ESP32 (ESPixel)',
        properties: ['openDirectory', 'createDirectory']
      })
      const outputDir = dirResult.filePaths[0]
      if (dirResult.canceled || outputDir === undefined) return null
      try {
        return await exportEspBundle(outputDir, payload)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[export-esp] failed:', err)
        throw new Error(`ESP export failed: ${msg}`)
      }
    }
  )

  ipcMain.handle(
    'project:export-fseq',
    async (_event, payload: FseqExportPayload): Promise<FseqExportResult | null> => {
      const dirResult = await dialog.showOpenDialog({
        title: 'Export Sequence for Falcon Player (FSEQ)',
        properties: ['openDirectory', 'createDirectory']
      })
      const outputDir = dirResult.filePaths[0]
      if (dirResult.canceled || outputDir === undefined) return null
      try {
        return await exportFseqBundle(outputDir, payload)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[export-fseq] failed:', err)
        throw new Error(`FSEQ export failed: ${msg}`)
      }
    }
  )
}
