import { createProjectFile, type ProjectFile } from '@shared/project'
import { DEFAULT_ENGINE_CONFIG } from '@shared/messages'
import { useEngineStore } from '@/store/engineStore'
import { useGraphStore } from '@/store/graphStore'
import { usePatchStore } from '@/store/patchStore'
import { useUiStore } from '@/store/uiStore'
import { useVisualiserStore } from '@/store/visualiserStore'
import { loadProjectIntoStores } from '@/project/loadProject'

export function buildCurrentProject(): ProjectFile {
  const graph = useGraphStore.getState().toGraphData()
  const { points, layout } = usePatchStore.getState()
  const patch = layout !== null ? { points, layout } : { points }
  const meta = useUiStore.getState().projectMeta
  return {
    ...createProjectFile(
      meta?.name ?? 'untitled',
      graph,
      patch,
      useEngineStore.getState().config,
      meta?.created
    ),
    visualiser: useVisualiserStore.getState().toSettings()
  }
}

export function loadProject(project: ProjectFile): void {
  loadProjectIntoStores(project)
  useVisualiserStore.getState().loadSettings(project.visualiser)
}

export async function newProject(): Promise<void> {
  await window.pixelforge.newProject()
  useGraphStore.getState().resetToDefault()
  usePatchStore.getState().resetToDefault()
  useEngineStore.getState().updateConfig({ ...DEFAULT_ENGINE_CONFIG })
  useEngineStore.getState().setOutputActive(false)
  useVisualiserStore.getState().loadSettings(undefined)
  useUiStore.getState().setProjectMeta(null)
}

export async function openProject(): Promise<void> {
  try {
    const project = await window.pixelforge.openProject()
    if (project === null) return
    loadProject(project)
  } catch (err) {
    alert(`Failed to open project: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function saveProject(saveAs = false): Promise<void> {
  const project = buildCurrentProject()
  try {
    const savedPath = saveAs
      ? await window.pixelforge.saveProjectAs(project)
      : await window.pixelforge.saveProject(project)
    if (savedPath !== null) {
      const base = savedPath.replace(/^.*[\\/]/, '').replace(/\.pxf$/i, '')
      useUiStore.getState().setProjectMeta({ name: base, created: project.meta.created })
    }
  } catch (err) {
    alert(`Failed to save project: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function openExample(filename: string): Promise<void> {
  try {
    const project = await window.pixelforge.openExample(filename)
    if (project === null) return
    loadProject(project)
  } catch (err) {
    alert(`Failed to open example: ${err instanceof Error ? err.message : String(err)}`)
  }
}
