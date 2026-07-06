import { resolve, sep } from 'node:path'
import type { GraphData } from '@shared/graph/types'

const MEDIA_PARAM_NAMES = new Set(['file', 'path', 'audioFile', 'imageFile', 'videoFile', 'stlPath'])

/**
 * Allowlist for `media:read`. The renderer can only read files it was granted
 * access to: files the user explicitly picked via a native dialog, or files
 * that live under an opened project / show directory. This stops a compromised
 * or patched renderer from reading arbitrary files off disk.
 */

const allowedFiles = new Set<string>()
const allowedRoots = new Set<string>()

/** Grant read access to a single file (e.g. one chosen via an open dialog). */
export function allowMediaFile(path: string): void {
  if (path === '') return
  allowedFiles.add(resolve(path))
}

/** Grant read access to every file under a directory (project / show folder). */
export function allowMediaRoot(dir: string): void {
  if (dir === '') return
  allowedRoots.add(resolve(dir))
}

/** Grant read access to every media path referenced by a project graph. */
export function allowGraphMedia(graph: GraphData): void {
  for (const node of graph.nodes) {
    for (const [key, value] of Object.entries(node.params)) {
      if (MEDIA_PARAM_NAMES.has(key) && typeof value === 'string' && value !== '') {
        allowMediaFile(value)
      }
    }
  }
}

/** True when `path` resolves inside an allowed file or root (no traversal). */
export function isMediaPathAllowed(path: string): boolean {
  const target = resolve(path)
  if (allowedFiles.has(target)) return true
  for (const root of allowedRoots) {
    if (target === root || target.startsWith(root + sep)) return true
  }
  return false
}
