import type { PlayerStartupConfig, ShowStartupHints, StartupPlan } from '@shared/playerStartup'
import type { PlayerCliArgs } from './args'
import { detectShowPathKind, resolveShowProjectPath } from './showPath'

export interface ResolveStartupPlanInput {
  cli: PlayerCliArgs
  saved: PlayerStartupConfig
  showHints?: ShowStartupHints | null
}

function cliSpecifiesShow(cli: PlayerCliArgs): boolean {
  return cli.project !== null || cli.showDir !== null
}

function resolveShowFromCli(cli: PlayerCliArgs): {
  showPath: string
  showPathKind: 'project' | 'show-folder'
} | null {
  if (cli.showDir !== null) {
    return { showPath: cli.showDir, showPathKind: 'show-folder' }
  }
  if (cli.project !== null) {
    return { showPath: cli.project, showPathKind: 'project' }
  }
  return null
}

function resolveShowFromSaved(saved: PlayerStartupConfig): {
  showPath: string
  showPathKind: 'project' | 'show-folder'
} | null {
  if (saved.showPath === null) return null
  return { showPath: saved.showPath, showPathKind: saved.showPathKind }
}

/** Merge CLI, saved config, and optional show hints into an effective startup plan. */
export function resolveStartupPlan(input: ResolveStartupPlanInput): StartupPlan {
  const { cli, saved, showHints } = input

  const cliShow = resolveShowFromCli(cli)
  const savedShow = resolveShowFromSaved(saved)
  const show = cliShow ?? savedShow

  let iface: string | null
  if (cli.iface !== null) {
    iface = cli.iface
  } else if (saved.interface !== null) {
    iface = saved.interface
  } else if (showHints?.interface !== undefined) {
    iface = showHints.interface ?? null
  } else {
    iface = null
  }

  let headless: boolean
  if (cli.headlessExplicit) {
    headless = cli.headless
  } else if (saved.headless !== null) {
    headless = saved.headless
  } else if (showHints?.headless !== undefined) {
    headless = showHints.headless
  } else {
    headless = false
  }

  let autoOutput: boolean
  if (cli.autoOutputExplicit) {
    autoOutput = cli.autoOutput
  } else if (cli.noOutput) {
    autoOutput = false
  } else if (saved.showPath !== null && !cliSpecifiesShow(cli)) {
    autoOutput = saved.autoOutput
  } else if (showHints?.autoOutput !== undefined) {
    autoOutput = showHints.autoOutput
  } else if (headless) {
    autoOutput = true
  } else {
    autoOutput = false
  }

  let projectPath: string | null = null
  if (show !== null) {
    try {
      projectPath = resolveShowProjectPath(show.showPath, show.showPathKind)
    } catch {
      projectPath = null
    }
  }

  return {
    projectPath,
    showPath: show?.showPath ?? null,
    showPathKind: show?.showPathKind ?? null,
    interface: iface,
    autoOutput,
    headless
  }
}

/** Validate plan and throw with a user-facing message if the show cannot load. */
export function validateStartupPlan(plan: StartupPlan): void {
  if (plan.showPath === null) return
  if (plan.projectPath === null) {
    throw new Error(`Show not found or invalid: ${plan.showPath}`)
  }
}

export function detectShowPathKindFromPath(showPath: string): 'project' | 'show-folder' {
  return detectShowPathKind(showPath)
}
