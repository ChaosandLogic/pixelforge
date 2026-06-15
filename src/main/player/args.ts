export interface PlayerCliArgs {
  project: string | null
  iface: string | null
  headless: boolean
  output: boolean
}

export function parsePlayerArgs(argv: string[]): PlayerCliArgs {
  let project: string | null = null
  let iface: string | null = null
  let headless = false
  let output = true

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--headless') {
      headless = true
      continue
    }
    if (arg === '--no-output') {
      output = false
      continue
    }
    if (arg === '--project' || arg === '-p') {
      project = argv[++i] ?? null
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
    if (arg.startsWith('--interface=')) {
      iface = arg.slice('--interface='.length)
    }
  }

  return { project, iface, headless, output }
}
