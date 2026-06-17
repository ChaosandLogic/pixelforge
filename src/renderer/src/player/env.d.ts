import type { NetworkInterfaceInfo } from '@shared/messages'
import type { ProjectFile } from '@shared/project'
import type { EngineConfig } from '@shared/messages'
import type { PlayerStartupConfig } from '@shared/playerStartup'

export interface LoginItemStatus {
  supported: boolean
  openAtLogin: boolean
  args: string[]
  manualCommand: string
}

export interface PlayerApi {
  getNetworkInterfaces: () => Promise<NetworkInterfaceInfo[]>
  requestEnginePort: () => void
  loadInitialProject: () => Promise<ProjectFile | null>
  getBootStatus: () => Promise<{ project: ProjectFile | null; autoOutput: boolean }>
  openProject: () => Promise<ProjectFile | null>
  startOutput: () => Promise<void>
  stopOutput: () => Promise<void>
  setEngineConfig: (config: Partial<EngineConfig>) => Promise<void>
  readMediaFile: (path: string) => Promise<ArrayBuffer>
  getLicenseStatus: () => Promise<import('@shared/licensing/types').LicenseStatus>
  activateLicense: (licenseKey: string, email: string) => Promise<import('@shared/licensing/types').LicenseStatus>
  deactivateLicense: () => Promise<void>
  getAppVersion: () => Promise<string>
  getStartupConfig: () => Promise<PlayerStartupConfig>
  setStartupConfig: (config: PlayerStartupConfig) => Promise<{ ok: boolean; error?: string }>
  pickShow: () => Promise<{ path: string; kind: 'project' | 'show-folder' } | null>
  readShowHints: (showDir: string) => Promise<import('@shared/playerStartup').ShowStartupHints | null>
  getLoginItemStatus: () => Promise<LoginItemStatus>
  applyStartupNow: () => Promise<{ ok: boolean; project?: ProjectFile; error?: string }>
}

declare global {
  interface Window {
    pixelforgePlayer: PlayerApi
  }
}

export {}
