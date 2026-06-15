import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { buildPatchMessage, resolveProjectMediaPaths } from '@shared/projectEngineSync'
import { migrateProjectFile, type ProjectFile } from '@shared/project'
import type { EngineLauncher } from './EngineLauncher'

export async function loadProjectFile(path: string): Promise<ProjectFile> {
  const absolute = resolve(path)
  const raw: unknown = JSON.parse(await readFile(absolute, 'utf-8'))
  const project = migrateProjectFile(raw)
  const projectDir = dirname(absolute)
  return {
    ...project,
    graph: resolveProjectMediaPaths(project.graph, projectDir),
    visualiser:
      project.visualiser?.stlPath !== undefined
        ? {
            ...project.visualiser,
            stlPath: resolveMediaPath(projectDir, project.visualiser.stlPath)
          }
        : project.visualiser
  }
}

export function pushProjectToEngine(launcher: EngineLauncher, project: ProjectFile): void {
  launcher.ensureClientPort()
  const patchMsg = buildPatchMessage(project.patch)
  launcher.sendToEngine({
    type: 'load-project',
    graph: project.graph,
    config: project.settings.engine,
    positions: patchMsg.positions,
    count: patchMsg.count,
    resolutionWidth: patchMsg.resolutionWidth,
    resolutionHeight: patchMsg.resolutionHeight,
    fixtureRanges: patchMsg.fixtureRanges
  })
}

export async function bootstrapProjectFromPath(
  launcher: EngineLauncher,
  path: string
): Promise<ProjectFile> {
  const project = await loadProjectFile(path)
  pushProjectToEngine(launcher, project)
  return project
}

function resolveMediaPath(projectDir: string, value: string): string {
  if (value.startsWith('/') || /^[a-zA-Z]:\\/.test(value)) return value
  return resolve(projectDir, value)
}
