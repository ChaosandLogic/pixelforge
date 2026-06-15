import { useGraphStore } from '@/store/graphStore'
import { usePatchStore } from '@/store/patchStore'
import { useEngineStore } from '@/store/engineStore'
import type { ProjectFile } from '@shared/project'

/** Load a project into Zustand stores (shared by Editor toolbar and Player). */
export function loadProjectIntoStores(project: ProjectFile): void {
  useGraphStore.getState().loadGraphData(project.graph)
  usePatchStore.getState().loadPatch(project.patch.points, project.patch.layout, project.meta.name)
  useEngineStore.getState().updateConfig(project.settings.engine)
}
