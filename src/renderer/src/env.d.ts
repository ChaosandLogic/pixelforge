/// <reference types="vite/client" />

import type { NetworkInterfaceInfo } from '@shared/messages'
import type { LicenseStatus } from '@shared/licensing/types'
import type { ExampleManifestEntry, ProjectFile } from '@shared/project'
import type { ShowManifest } from '@shared/showExportTypes'
import type { ShowStartupHints } from '@shared/playerStartup'

declare global {
  interface Window {
    pixelforge: {
      getNetworkInterfaces: () => Promise<NetworkInterfaceInfo[]>
      requestEnginePort: () => void
      saveProject: (project: ProjectFile) => Promise<string | null>
      openProject: () => Promise<ProjectFile | null>
      exportShow: (project: ProjectFile, startup?: ShowStartupHints) => Promise<{ outputDir: string; manifest: ShowManifest } | null>
      listExamples: () => Promise<ExampleManifestEntry[]>
      openExample: (filename: string) => Promise<ProjectFile | null>
      pickVideoFile: () => Promise<string | null>
      pickImageFile: () => Promise<string | null>
      pickStlFile: () => Promise<string | null>
      pickAudioFile: () => Promise<string | null>
      requestMicAccess: () => Promise<boolean>
      readMediaFile: (path: string) => Promise<ArrayBuffer>
      openTextFile: (extensions: string[]) => Promise<{ name: string; content: string } | null>
      saveTextFile: (content: string, defaultName: string) => Promise<string | null>
      getLicenseStatus: () => Promise<LicenseStatus>
      activateLicense: (licenseKey: string, email: string) => Promise<LicenseStatus>
      deactivateLicense: () => Promise<void>
      getOnboardingSeen: () => Promise<boolean>
      setOnboardingSeen: () => Promise<void>
      getAppVersion: () => Promise<string>
    }
    pixelforgePlayer?: import('./player/env.d').PlayerApi
  }
}

export {}
