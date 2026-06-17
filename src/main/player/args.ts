export interface PlayerCliArgs {
  project: string | null
  showDir: string | null
  iface: string | null
  headless: boolean
  /** True when --headless was passed on the command line */
  headlessExplicit: boolean
  autoOutput: boolean
  /** True when --auto-output was passed on the command line */
  autoOutputExplicit: boolean
  noOutput: boolean
}

export function parsePlayerArgs(argv: string[]): PlayerCliArgs {
  let project: string | null = null
  let showDir: string | null = null
  let iface: string | null = null
  let headless = false
  let headlessExplicit = false
  let autoOutput = false
  let autoOutputExplicit = false
  let noOutput = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--headless') {
      headless = true
      headlessExplicit = true
      continue
    }
    if (arg === '--no-output') {
      noOutput = true
      continue
    }
    if (arg === '--auto-output') {
      autoOutput = true
      autoOutputExplicit = true
      continue
    }
    if (arg === '--project' || arg === '-p') {
      project = argv[++i] ?? null
      continue
    }
    if (arg === '--show-dir' || arg === '--show') {
      showDir = argv[++i] ?? null
      continue
    }
    if (arg === '--interface' || arg === '-i') {
      iface = argv[++i] ?? null
      continue
    }
    if (arg.startsWith('--project=')) {
      project = arg.slice('--project='.length)
      continue
    }
    if (arg.startsWith('--show-dir=') || arg.startsWith('--show=')) {
      showDir = arg.slice(arg.indexOf('=') + 1)
      continue
    }
    if (arg.startsWith('--interface=')) {
      iface = arg.slice('--interface='.length)
      continue
    }
    if (!arg.startsWith('-') && arg.toLowerCase().endsWith('.pxf')) {
      project = arg
    }
  }

  return {
    project,
    showDir,
    iface,
    headless,
    headlessExplicit,
    autoOutput,
    autoOutputExplicit,
    noOutput
  }
}
