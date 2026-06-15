import { app, ipcMain } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

function onboardingPath(): string {
  return join(app.getPath('userData'), 'onboarding.json')
}

export function registerOnboardingIpc(): void {
  ipcMain.handle('onboarding:seen', async (): Promise<boolean> => {
    const path = onboardingPath()
    if (!existsSync(path)) return false
    try {
      const raw: unknown = JSON.parse(await readFile(path, 'utf-8'))
      return typeof raw === 'object' && raw !== null && (raw as { seen?: boolean }).seen === true
    } catch {
      return false
    }
  })

  ipcMain.handle('onboarding:set-seen', async (): Promise<void> => {
    await writeFile(onboardingPath(), JSON.stringify({ seen: true }), 'utf-8')
  })
}
