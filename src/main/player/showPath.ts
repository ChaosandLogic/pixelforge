import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import type { ShowStartupHints } from '@shared/playerStartup'

/**
 * Resolve a show-manifest `project` field against the show folder, rejecting
 * absolute paths and `..` traversal so a malicious show.json cannot point at
 * files outside its own folder.
 */
export function resolveShowRelativePath(showDir: string, relative: string): string {
  const base = resolve(showDir)
  const target = resolve(base, relative)
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error(`Show project path escapes the show folder: ${relative}`)
  }
  return target
}

export function detectShowPathKind(showPath: string): 'project' | 'show-folder' {
  const absolute = resolve(showPath)
  if (absolute.toLowerCase().endsWith('.pxf')) return 'project'
  return 'show-folder'
}

export function resolveShowProjectPath(
  showPath: string,
  kind: 'project' | 'show-folder'
): string {
  const absolute = resolve(showPath)
  if (kind === 'project') {
    if (!existsSync(absolute)) throw new Error(`Project file not found: ${absolute}`)
    return absolute
  }
  const manifestPath = join(absolute, 'show.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`show.json not found in show folder: ${absolute}`)
  }
  const raw: unknown = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  const manifest = raw as { project?: string }
  const projectPath = resolveShowRelativePath(absolute, manifest.project ?? 'show.pxf')
  if (!existsSync(projectPath)) {
    throw new Error(`Project file not found in show folder: ${projectPath}`)
  }
  return projectPath
}

export function readShowStartupHints(showDir: string): ShowStartupHints | null {
  const manifestPath = resolve(showDir, 'show.json')
  if (!existsSync(manifestPath)) return null
  try {
    const raw: unknown = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    const startup = (raw as { startup?: ShowStartupHints }).startup
    return startup ?? null
  } catch {
    return null
  }
}
