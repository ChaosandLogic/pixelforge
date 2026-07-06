import { contextBridge, ipcRenderer } from 'electron'
import type { NetworkInterfaceInfo } from '@shared/messages'
import type { LicenseStatus } from '@shared/licensing/types'
import type { ExampleManifestEntry, ProjectFile } from '@shared/project'
import type { EspExportPayload, EspExportResult } from '@shared/espExportTypes'
import type { FseqExportPayload, FseqExportResult } from '@shared/fseqExportTypes'
import type { ShowManifest } from '@shared/showExportTypes'
import type { ShowStartupHints } from '@shared/playerStartup'

export interface PixelForgeApi {
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
  getLicenseStatus: () => Promise<LicenseStatus>
  activateLicense: (licenseKey: string, email: string) => Promise<LicenseStatus>
  deactivateLicense: () => Promise<void>
  getOnboardingSeen: () => Promise<boolean>
  setOnboardingSeen: () => Promise<void>
  getAppVersion: () => Promise<string>
}

const api: PixelForgeApi = {
  getNetworkInterfaces: () => ipcRenderer.invoke('network:interfaces'),
  requestEnginePort: () => ipcRenderer.send('engine:request-port'),
  saveProject: (project) => ipcRenderer.invoke('project:save', project),
  openProject: () => ipcRenderer.invoke('project:open'),
  exportShow: (project, startup) => ipcRenderer.invoke('project:export-show', project, startup),
  exportEsp: (payload) => ipcRenderer.invoke('project:export-esp', payload),
  exportFseq: (payload) => ipcRenderer.invoke('project:export-fseq', payload),
  listExamples: () => ipcRenderer.invoke('project:list-examples'),
  openExample: (filename) => ipcRenderer.invoke('project:open-example', filename),
  pickVideoFile: () => ipcRenderer.invoke('media:pick-video'),
  pickImageFile: () => ipcRenderer.invoke('media:pick-image'),
  pickStlFile: () => ipcRenderer.invoke('media:pick-stl'),
  pickAudioFile: () => ipcRenderer.invoke('media:pick-audio'),
  requestMicAccess: () => ipcRenderer.invoke('media:request-mic'),
  readMediaFile: (path) => ipcRenderer.invoke('media:read', path),
  openTextFile: (extensions) => ipcRenderer.invoke('files:open-text', extensions),
  saveTextFile: (content, defaultName) => ipcRenderer.invoke('files:save-text', content, defaultName),
  getLicenseStatus: () => ipcRenderer.invoke('license:status'),
  activateLicense: (licenseKey, email) => ipcRenderer.invoke('license:activate', licenseKey, email),
  deactivateLicense: () => ipcRenderer.invoke('license:deactivate'),
  getOnboardingSeen: () => ipcRenderer.invoke('onboarding:seen'),
  setOnboardingSeen: () => ipcRenderer.invoke('onboarding:set-seen'),
  getAppVersion: () => ipcRenderer.invoke('app:version')
}

contextBridge.exposeInMainWorld('pixelforge', api)

ipcRenderer.on('engine-port', (event) => {
  window.postMessage({ type: 'pixelforge-engine-port' }, '*', event.ports)
})

ipcRenderer.on('engine:reconnect', () => {
  window.postMessage({ type: 'pixelforge-engine-reconnect' }, '*')
})

ipcRenderer.on('app:show-about', () => {
  window.postMessage({ type: 'pixelforge-show-about' }, '*')
})

ipcRenderer.on('app:show-shortcuts', () => {
  window.postMessage({ type: 'pixelforge-show-shortcuts' }, '*')
})

ipcRenderer.on('app:show-license', () => {
  window.postMessage({ type: 'pixelforge-show-license' }, '*')
})
