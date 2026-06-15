import type { GraphData } from './graph/types'
import type { EngineConfig } from './messages'
import { generateLinePatch, type PatchData } from './patch/types'

/**
 * Versioned project file (`.pxf`). Every save writes the current version;
 * every load checks it and runs migrations when the schema changes.
 */
export const PROJECT_VERSION = '1.4.0'

export interface VisualiserSettings {
  /** Absolute path to the reference STL mesh (reload on project open). */
  stlPath?: string
  meshVisible?: boolean
  /** World-space radius of each instanced pixel sphere. */
  pixelSize?: number
}

export interface ExampleManifestEntry {
  filename: string
  name: string
  description: string
}

export interface ProjectFile {
  version: string
  meta: {
    name: string
    created: string
    modified: string
  }
  patch: PatchData
  graph: GraphData
  settings: {
    engine: EngineConfig
  }
  visualiser?: VisualiserSettings
}

export function createProjectFile(
  name: string,
  graph: GraphData,
  patch: PatchData,
  engine: EngineConfig,
  created?: string
): ProjectFile {
  const now = new Date().toISOString()
  return {
    version: PROJECT_VERSION,
    meta: { name, created: created ?? now, modified: now },
    patch,
    graph,
    settings: { engine }
  }
}

/** Validate + migrate a parsed project file. Throws on unusable input. */
export function migrateProjectFile(raw: unknown): ProjectFile {
  if (typeof raw !== 'object' || raw === null) throw new Error('Not a PixelForge project file')
  const candidate = raw as Record<string, unknown>
  if (typeof candidate['version'] !== 'string') throw new Error('Missing project version')
  if (candidate['graph'] === undefined || candidate['settings'] === undefined) {
    throw new Error('Project file is missing graph or settings')
  }

  // 1.0.0 -> 1.1.0: patch added; engine config moved from per-pixel
  // universe/pixelCount to startUniverse + patch-derived count.
  if (candidate['version'] === '1.0.0') {
    const settings = candidate['settings'] as { engine: Record<string, unknown> }
    const oldUniverse = settings.engine['universe']
    const oldPixelCount = settings.engine['pixelCount']
    settings.engine['startUniverse'] = typeof oldUniverse === 'number' ? oldUniverse : 1
    delete settings.engine['universe']
    delete settings.engine['pixelCount']
    candidate['patch'] = {
      points: generateLinePatch(typeof oldPixelCount === 'number' ? oldPixelCount : 170)
    }
    candidate['version'] = '1.1.0'
  }

  if (candidate['patch'] === undefined) {
    candidate['patch'] = { points: generateLinePatch(170) }
  }

  // 1.1.0 -> 1.2.0: optional patch.layout (no-op if absent).
  if (candidate['version'] === '1.1.0') {
    candidate['version'] = '1.2.0'
  }

  // 1.2.0 -> 1.3.0: optional visualiser settings (no-op if absent).
  if (candidate['version'] === '1.2.0') {
    candidate['version'] = '1.3.0'
  }

  // 1.3.0 -> 1.4.0: Universe Output node renamed to Pixel Output.
  if (candidate['version'] === '1.3.0') {
    const graph = candidate['graph'] as { nodes?: Array<{ type?: string }> } | undefined
    if (graph?.nodes !== undefined) {
      for (const node of graph.nodes) {
        if (node.type === 'output/universe') node.type = 'output/pixel'
      }
    }
    candidate['version'] = '1.4.0'
  }

  return candidate as unknown as ProjectFile
}
