import { app } from 'electron'
import { resolve } from 'node:path'
import { isStartupConfigReadyForLogin, type PlayerStartupConfig } from '@shared/playerStartup'

export interface LoginItemStatus {
  supported: boolean
  openAtLogin: boolean
  /** CLI args Electron will pass on login launch */
  args: string[]
  /** Human-readable command for manual autostart (Linux fallback) */
  manualCommand: string
}

function buildLoginArgs(config: PlayerStartupConfig): string[] {
  const args: string[] = []
  if (config.showPath === null) return args

  if (config.showPathKind === 'show-folder') {
    args.push('--show-dir', resolve(config.showPath))
  } else {
    args.push('--project', resolve(config.showPath))
  }

  if (config.interface !== null) {
    args.push('--interface', config.interface)
  }
  if (config.headless === true) {
    args.push('--headless')
  }
  if (config.autoOutput) {
    args.push('--auto-output')
  } else {
    args.push('--no-output')
  }
  return args
}

function execPath(): string {
  return process.execPath
}

export function buildManualAutostartCommand(config: PlayerStartupConfig): string {
  const args = buildLoginArgs(config)
  const quoted = args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')
  return `"${execPath()}" ${quoted}`
}

export function syncLoginItem(config: PlayerStartupConfig): LoginItemStatus {
  const args = buildLoginArgs(config)
  const manualCommand = buildManualAutostartCommand(config)
  const supported = process.platform === 'darwin' || process.platform === 'win32'

  if (!config.launchAtLogin || !isStartupConfigReadyForLogin(config)) {
    if (supported) {
      app.setLoginItemSettings({ openAtLogin: false })
    }
    return {
      supported,
      openAtLogin: false,
      args,
      manualCommand
    }
  }

  if (supported) {
    app.setLoginItemSettings({
      openAtLogin: true,
      args,
      path: execPath()
    })
  }

  return {
    supported,
    openAtLogin: config.launchAtLogin && supported,
    args,
    manualCommand
  }
}

export function getLoginItemStatus(config: PlayerStartupConfig): LoginItemStatus {
  const args = buildLoginArgs(config)
  const manualCommand = buildManualAutostartCommand(config)
  const supported = process.platform === 'darwin' || process.platform === 'win32'

  if (!supported) {
    return {
      supported: false,
      openAtLogin: config.launchAtLogin,
      args,
      manualCommand
    }
  }

  const settings = app.getLoginItemSettings()
  return {
    supported: true,
    openAtLogin: settings.openAtLogin,
    args,
    manualCommand
  }
}
