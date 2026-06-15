import { dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'

interface OpenedTextFile {
  name: string
  content: string
}

export function registerFileIpc(): void {
  ipcMain.handle(
    'files:open-text',
    async (_event, extensions: string[]): Promise<OpenedTextFile | null> => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Supported', extensions }]
      })
      const path = result.filePaths[0]
      if (result.canceled || path === undefined) return null
      return { name: basename(path), content: await readFile(path, 'utf-8') }
    }
  )

  ipcMain.handle(
    'files:save-text',
    async (_event, content: string, defaultName: string): Promise<string | null> => {
      const result = await dialog.showSaveDialog({ defaultPath: defaultName })
      if (result.canceled || result.filePath === undefined) return null
      await writeFile(result.filePath, content, 'utf-8')
      return result.filePath
    }
  )
}
