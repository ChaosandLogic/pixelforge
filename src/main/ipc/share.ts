import { ipcMain } from 'electron'
import { listShareSenders } from '../share/listSenders'
import type { ShareReceiverHub } from '../share/receiver'
import type { ShareInputSub } from '@shared/share/senders'

export function registerShareIpc(hub: ShareReceiverHub): void {
  ipcMain.handle('share:listSenders', (): string[] => listShareSenders())
  ipcMain.handle('share:setInputs', (_event, inputs: ShareInputSub[]): void => {
    hub.setInputs(Array.isArray(inputs) ? inputs : [])
  })
}
