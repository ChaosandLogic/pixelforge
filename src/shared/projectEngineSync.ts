import type { GraphData } from './graph/types'
import type { RendererToEngine } from './messages'
import { fixtureRanges } from './patch/layout'
import { inferResolutionFromLayout } from './spatial/resolution'
import { pointsToPositions, type PatchData } from './patch/types'
import type { ProjectFile } from './project'

/** Build ordered engine messages to fully load a project. */
export function buildEngineLoadMessages(project: ProjectFile): RendererToEngine[] {
  const patchMsg = buildPatchMessage(project.patch)
  return [
    { type: 'set-config', config: project.settings.engine },
    patchMsg,
    { type: 'set-graph', graph: project.graph }
  ]
}

export function buildPatchMessage(patch: PatchData): Extract<RendererToEngine, { type: 'set-patch' }> {
  const points = patch.points
  const layout = patch.layout ?? null
  const resolution = inferResolutionFromLayout(layout, points.length)
  return {
    type: 'set-patch',
    positions: pointsToPositions(points),
    count: points.length,
    resolutionWidth: resolution.width,
    resolutionHeight: resolution.height,
    fixtureRanges: layout !== null ? fixtureRanges(layout) : []
  }
}

/** Resolve relative media paths in graph node params against a project directory. */
export function resolveProjectMediaPaths(graph: GraphData, projectDir: string): GraphData {
  const mediaParamNames = new Set(['file', 'path', 'audioFile', 'imageFile', 'videoFile', 'stlPath'])
  const nodes = graph.nodes.map((node) => {
    const params = { ...node.params }
    let changed = false
    for (const [key, value] of Object.entries(params)) {
      if (!mediaParamNames.has(key) || typeof value !== 'string' || value === '') continue
      if (value.startsWith('/') || /^[a-zA-Z]:\\/.test(value)) continue
      params[key] = joinPath(projectDir, value)
      changed = true
    }
    return changed ? { ...node, params } : node
  })
  return nodes === graph.nodes ? graph : { ...graph, nodes }
}

function joinPath(dir: string, rel: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  const normalized = dir.replace(/[/\\]+$/, '')
  const relTrim = rel.replace(/^[/\\]+/, '')
  return `${normalized}${sep}${relTrim}`
}
