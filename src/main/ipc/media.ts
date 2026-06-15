import { dialog, ipcMain, systemPreferences } from 'electron'
import { readFile } from 'node:fs/promises'

export function registerMediaIpc(): void {
  ipcMain.handle('media:pick-video', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose Video',
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi'] }]
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('media:pick-image', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose Image',
      properties: ['openFile'],
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('media:pick-stl', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose STL Model',
      properties: ['openFile'],
      filters: [{ name: 'STL', extensions: ['stl'] }]
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('media:pick-audio', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose Audio',
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'aiff'] }]
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('media:request-mic', async (): Promise<boolean> => {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('microphone')
      if (status === 'granted') return true
      return systemPreferences.askForMediaAccess('microphone')
    }
    return true
  })

  // The renderer can't read arbitrary file:// paths from an http origin in
  // dev; it fetches bytes over IPC and plays them via a blob URL instead.
  ipcMain.handle('media:read', async (_event, path: string): Promise<ArrayBuffer> => {
    const buf = await readFile(path)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  })
}
