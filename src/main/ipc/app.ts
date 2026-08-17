import { app, ipcMain } from 'electron'

export type NativeEditCommand = 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll'

export function registerAppIpc(): void {
  ipcMain.handle('app:version', (): string => app.getVersion())
  ipcMain.on('app:native-edit', (event, command: NativeEditCommand) => {
    const wc = event.sender
    if (command === 'undo') wc.undo()
    else if (command === 'redo') wc.redo()
    else if (command === 'cut') wc.cut()
    else if (command === 'copy') wc.copy()
    else if (command === 'paste') wc.paste()
    else wc.selectAll()
  })
}
