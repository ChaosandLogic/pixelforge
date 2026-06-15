import { create } from 'zustand'
import type { VisualiserSettings } from '@shared/project'

interface VisualiserState {
  stlPath: string | null
  stlName: string | null
  meshVisible: boolean
  pixelSize: number
  loadError: string | null

  setStl: (path: string | null, name?: string | null) => void
  setMeshVisible: (visible: boolean) => void
  setPixelSize: (size: number) => void
  setLoadError: (error: string | null) => void
  toSettings: () => VisualiserSettings
  loadSettings: (settings: VisualiserSettings | undefined) => void
}

export const useVisualiserStore = create<VisualiserState>((set, get) => ({
  stlPath: null,
  stlName: null,
  meshVisible: true,
  pixelSize: 0.025,
  loadError: null,

  setStl: (path, name = null) => {
    set({
      stlPath: path,
      stlName: name ?? (path !== null ? path.split('/').pop() ?? path : null),
      loadError: null
    })
  },

  setMeshVisible: (visible) => set({ meshVisible: visible }),

  setPixelSize: (size) => set({ pixelSize: Math.max(0.001, Math.min(0.5, size)) }),

  setLoadError: (error) => set({ loadError: error }),

  toSettings: () => {
    const { stlPath, meshVisible, pixelSize } = get()
    const settings: VisualiserSettings = { meshVisible, pixelSize }
    if (stlPath !== null) settings.stlPath = stlPath
    return settings
  },

  loadSettings: (settings) => {
    if (settings === undefined) {
      set({ stlPath: null, stlName: null, meshVisible: true, pixelSize: 0.025, loadError: null })
      return
    }
    set({
      stlPath: settings.stlPath ?? null,
      stlName: settings.stlPath !== undefined ? (settings.stlPath.split('/').pop() ?? settings.stlPath) : null,
      meshVisible: settings.meshVisible ?? true,
      pixelSize: settings.pixelSize ?? 0.025,
      loadError: null
    })
  }
}))
