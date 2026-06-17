export interface PlayerStartupConfig {
  version: '1.0.0'
  /** Absolute path to .pxf or exported show folder */
  showPath: string | null
  showPathKind: 'project' | 'show-folder'
  interface: string | null
  autoOutput: boolean
  /** User must explicitly choose — no implicit default in saved config */
  headless: boolean | null
  launchAtLogin: boolean
}

export interface ShowStartupHints {
  interface?: string | null
  autoOutput?: boolean
  headless?: boolean
}

export interface StartupPlan {
  /** Resolved absolute path to the .pxf file */
  projectPath: string | null
  /** Original show path (project file or show folder) */
  showPath: string | null
  showPathKind: 'project' | 'show-folder' | null
  interface: string | null
  autoOutput: boolean
  headless: boolean
}

export const DEFAULT_PLAYER_STARTUP_CONFIG: PlayerStartupConfig = {
  version: '1.0.0',
  showPath: null,
  showPathKind: 'project',
  interface: null,
  autoOutput: true,
  headless: null,
  launchAtLogin: false
}

export function isStartupConfigReadyForLogin(config: PlayerStartupConfig): boolean {
  return config.showPath !== null && config.headless !== null
}
