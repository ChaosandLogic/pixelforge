import { app } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DEFAULT_PLAYER_STARTUP_CONFIG,
  type PlayerStartupConfig
} from '@shared/playerStartup'

function configPath(): string {
  return join(app.getPath('userData'), 'player-startup.json')
}

function parseConfig(raw: unknown): PlayerStartupConfig {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_PLAYER_STARTUP_CONFIG }
  const obj = raw as Partial<PlayerStartupConfig>
  return {
    version: '1.0.0',
    showPath: typeof obj.showPath === 'string' ? obj.showPath : null,
    showPathKind: obj.showPathKind === 'show-folder' ? 'show-folder' : 'project',
    interface: typeof obj.interface === 'string' ? obj.interface : null,
    autoOutput: obj.autoOutput !== false,
    headless:
      obj.headless === true ? true : obj.headless === false ? false : null,
    launchAtLogin: obj.launchAtLogin === true
  }
}

export async function readPlayerStartupConfig(): Promise<PlayerStartupConfig> {
  const path = configPath()
  if (!existsSync(path)) return { ...DEFAULT_PLAYER_STARTUP_CONFIG }
  try {
    const raw: unknown = JSON.parse(await readFile(path, 'utf-8'))
    return parseConfig(raw)
  } catch {
    return { ...DEFAULT_PLAYER_STARTUP_CONFIG }
  }
}

export async function writePlayerStartupConfig(config: PlayerStartupConfig): Promise<void> {
  const dir = app.getPath('userData')
  await mkdir(dir, { recursive: true })
  await writeFile(configPath(), JSON.stringify(config, null, 2), 'utf-8')
}
