import type { NetworkInterfaceInfo } from '@shared/messages'
import type { ProjectFile } from '@shared/project'
import type { EngineConfig } from '@shared/messages'

export interface PlayerApi {
  getNetworkInterfaces: () => Promise<NetworkInterfaceInfo[]>
  requestEnginePort: () => void
  loadInitialProject: () => Promise<ProjectFile | null>
  openProject: () => Promise<ProjectFile | null>
  startOutput: () => Promise<void>
  stopOutput: () => Promise<void>
  setEngineConfig: (config: Partial<EngineConfig>) => Promise<void>
  readMediaFile: (path: string) => Promise<ArrayBuffer>
  getLicenseStatus: () => Promise<import('@shared/licensing/types').LicenseStatus>
  activateLicense: (licenseKey: string, email: string) => Promise<import('@shared/licensing/types').LicenseStatus>
  deactivateLicense: () => Promise<void>
  getAppVersion: () => Promise<string>
}

declare global {
  interface Window {
    pixelforgePlayer: PlayerApi
  }
}

export {}
