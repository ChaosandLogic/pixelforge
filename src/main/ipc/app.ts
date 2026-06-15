import { app, ipcMain } from 'electron'

export function registerAppIpc(): void {
  ipcMain.handle('app:version', (): string => app.getVersion())
}
