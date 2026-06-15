import { create } from 'zustand'

const STORAGE_KEY = 'pixelforge-profiler'

interface UiState {
  profilerEnabled: boolean
  setProfilerEnabled: (enabled: boolean) => void
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
  }
}))
