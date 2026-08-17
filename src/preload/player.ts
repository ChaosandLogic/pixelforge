import { contextBridge, ipcRenderer } from 'electron'
import type { EngineConfig } from '@shared/messages'
import type { PlayerStartupConfig } from '@shared/playerStartup'
import type { ProjectFile } from '@shared/project'

const api = {
  getNetworkInterfaces: () => ipcRenderer.invoke('network:interfaces'),
  requestEnginePort: () => ipcRenderer.send('engine:request-port'),
  loadInitialProject: () => ipcRenderer.invoke('player:load-initial'),
  getBootStatus: () =>
    ipcRenderer.invoke('player:get-boot-status') as Promise<{
      project: ProjectFile | null
      autoOutput: boolean
    }>,
  openProject: () => ipcRenderer.invoke('player:open-project'),
  startOutput: () => ipcRenderer.invoke('player:start-output'),
  stopOutput: () => ipcRenderer.invoke('player:stop-output'),
  setEngineConfig: (config: Partial<EngineConfig>) => ipcRenderer.invoke('player:set-config', config),
  readMediaFile: (path: string) => ipcRenderer.invoke('media:read', path),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getStartupConfig: (): Promise<PlayerStartupConfig> => ipcRenderer.invoke('player:get-startup-config'),
  setStartupConfig: (config: PlayerStartupConfig): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('player:set-startup-config', config),
  pickShow: (): Promise<{ path: string; kind: 'project' | 'show-folder' } | null> =>
    ipcRenderer.invoke('player:pick-show'),
  readShowHints: (showDir: string) => ipcRenderer.invoke('player:read-show-hints', showDir),
  getLoginItemStatus: () => ipcRenderer.invoke('player:get-login-item-status'),
  applyStartupNow: (): Promise<{ ok: boolean; project?: ProjectFile; error?: string }> =>
    ipcRenderer.invoke('player:apply-startup-now')
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

ipcRenderer.on('player:show-startup-panel', () => {
  window.postMessage({ type: 'pixelforge-show-startup-panel' }, '*')
})

ipcRenderer.on('player:open-show', () => {
  window.postMessage({ type: 'pixelforge-open-show' }, '*')
})
