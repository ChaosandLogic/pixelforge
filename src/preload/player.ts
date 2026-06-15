import { contextBridge, ipcRenderer } from 'electron'
import type { EngineConfig } from '@shared/messages'
import type { LicenseStatus } from '@shared/licensing/types'

const api = {
  getNetworkInterfaces: () => ipcRenderer.invoke('network:interfaces'),
  requestEnginePort: () => ipcRenderer.send('engine:request-port'),
  loadInitialProject: () => ipcRenderer.invoke('player:load-initial'),
  openProject: () => ipcRenderer.invoke('player:open-project'),
  startOutput: () => ipcRenderer.invoke('player:start-output'),
  stopOutput: () => ipcRenderer.invoke('player:stop-output'),
  setEngineConfig: (config: Partial<EngineConfig>) => ipcRenderer.invoke('player:set-config', config),
  readMediaFile: (path: string) => ipcRenderer.invoke('media:read', path),
  getLicenseStatus: (): Promise<LicenseStatus> => ipcRenderer.invoke('license:status'),
  activateLicense: (licenseKey: string, email: string): Promise<LicenseStatus> =>
    ipcRenderer.invoke('license:activate', licenseKey, email),
  deactivateLicense: (): Promise<void> => ipcRenderer.invoke('license:deactivate'),
  getAppVersion: () => ipcRenderer.invoke('app:version')
}

contextBridge.exposeInMainWorld('pixelforgePlayer', api)

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
