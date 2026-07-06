/// <reference types="vite/client" />

import type { NetworkInterfaceInfo } from '@shared/messages'
import type { ExampleManifestEntry, ProjectFile } from '@shared/project'
import type { EspExportPayload, EspExportResult } from '@shared/espExportTypes'
import type { FseqExportPayload, FseqExportResult } from '@shared/fseqExportTypes'
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
      exportEsp: (payload: EspExportPayload) => Promise<EspExportResult | null>
      exportFseq: (payload: FseqExportPayload) => Promise<FseqExportResult | null>
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
      getOnboardingSeen: () => Promise<boolean>
      setOnboardingSeen: () => Promise<void>
      getAppVersion: () => Promise<string>
    }
    pixelforgePlayer?: import('./player/env.d').PlayerApi
  }
}

export {}
