import { create } from 'zustand'

const STORAGE_KEY = 'pixelforge-profiler'

/** Metadata of the currently loaded project, preserved across saves. */
export interface ProjectMeta {
  name: string
  created: string
}

interface UiState {
  profilerEnabled: boolean
  setProfilerEnabled: (enabled: boolean) => void
  projectMeta: ProjectMeta | null
  setProjectMeta: (meta: ProjectMeta | null) => void
}

function loadProfilerEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return false
    return JSON.parse(raw) === true
  } catch {
    return false
  }
}

function persistProfilerEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled))
  } catch {
    /* ignore */
  }
}

export const useUiStore = create<UiState>((set) => ({
  profilerEnabled: loadProfilerEnabled(),

  setProfilerEnabled: (enabled) => {
    set({ profilerEnabled: enabled })
    persistProfilerEnabled(enabled)
  },

  projectMeta: null,
  setProjectMeta: (meta) => set({ projectMeta: meta })
}))
