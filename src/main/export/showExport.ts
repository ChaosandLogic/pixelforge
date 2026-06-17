import { mkdir, copyFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import type { GraphData } from '@shared/graph/types'
import type { ProjectFile } from '@shared/project'
import type { ShowManifest } from '@shared/showExportTypes'
import type { ShowStartupHints } from '@shared/playerStartup'

const MEDIA_PARAM_NAMES = new Set(['file', 'path', 'audioFile', 'imageFile', 'videoFile', 'stlPath'])

export interface CollectedAsset {
  absolutePath: string
  relativePath: string
}

/** Collect media file paths referenced by the graph and visualiser settings. */
export function collectProjectAssets(project: ProjectFile, projectPath: string): CollectedAsset[] {
  const projectDir = dirname(resolve(projectPath))
  const seen = new Set<string>()
  const assets: CollectedAsset[] = []

  const add = (value: string | undefined): void => {
    if (value === undefined || value === '') return
    const absolute = value.startsWith('/') || /^[a-zA-Z]:\\/.test(value) ? value : resolve(projectDir, value)
    if (seen.has(absolute)) return
    seen.add(absolute)
    assets.push({ absolutePath: absolute, relativePath: basename(absolute) })
  }

  for (const node of project.graph.nodes) {
    for (const [key, value] of Object.entries(node.params)) {
      if (MEDIA_PARAM_NAMES.has(key) && typeof value === 'string') add(value)
    }
  }
  add(project.visualiser?.stlPath)
  return assets
}

/** Rewrite graph media paths to relative filenames for portable show folders. */
export function relativizeProjectForExport(
  project: ProjectFile,
  assets: CollectedAsset[],
  projectDir: string
): ProjectFile {
  const byAbsolute = new Map(assets.map((a) => [a.absolutePath, a.relativePath]))
  const resolvePath = (value: string): string =>
    value.startsWith('/') || /^[a-zA-Z]:\\/.test(value) ? resolve(value) : resolve(projectDir, value)
  const graph: GraphData = {
    ...project.graph,
    nodes: project.graph.nodes.map((node) => {
      const params = { ...node.params }
      let changed = false
      for (const [key, value] of Object.entries(params)) {
        if (!MEDIA_PARAM_NAMES.has(key) || typeof value !== 'string' || value === '') continue
        const absolute = resolvePath(value)
        const rel = byAbsolute.get(absolute)
        if (rel !== undefined) {
          params[key] = rel
          changed = true
        }
      }
      return changed ? { ...node, params } : node
    })
  }
  const stlPath = project.visualiser?.stlPath
  const stlRel =
    stlPath !== undefined ? byAbsolute.get(resolvePath(stlPath)) ?? basename(stlPath) : undefined
  return {
    ...project,
    graph,
    visualiser:
      project.visualiser !== undefined
        ? { ...project.visualiser, stlPath: stlRel ?? project.visualiser.stlPath }
        : undefined
  }
}

export async function exportShowBundle(
  project: ProjectFile,
  sourceProjectPath: string,
  outputDir: string,
  startup?: ShowStartupHints
): Promise<ShowManifest> {
  const assets = collectProjectAssets(project, sourceProjectPath)
  const projectDir = dirname(resolve(sourceProjectPath))
  await mkdir(outputDir, { recursive: true })
  const assetsDir = join(outputDir, 'assets')
  await mkdir(assetsDir, { recursive: true })

  const copiedAssets: string[] = []
  for (const asset of assets) {
    const dest = join(assetsDir, asset.relativePath)
    await copyFile(asset.absolutePath, dest)
    copiedAssets.push(`assets/${asset.relativePath}`)
  }

  const exported = relativizeProjectForExport(project, assets, projectDir)
  const projectFilename = 'show.pxf'
  await writeFile(join(outputDir, projectFilename), JSON.stringify(exported, null, 2), 'utf-8')

  const manifest: ShowManifest = {
    version: '1.0.0',
    name: project.meta.name,
    project: projectFilename,
    exportedAt: new Date().toISOString(),
    assets: copiedAssets,
    ...(startup !== undefined ? { startup } : {})
  }
  await writeFile(join(outputDir, 'show.json'), JSON.stringify(manifest, null, 2), 'utf-8')
  return manifest
}

export type { ShowManifest }
