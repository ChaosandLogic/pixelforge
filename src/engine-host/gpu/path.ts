import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function gpuEnginePath(): string | null {
  const fromEnv = process.env['PIXELFORGE_GPU_ENGINE']
  if (fromEnv !== undefined && fromEnv !== '' && existsSync(fromEnv)) return fromEnv

  const name = process.platform === 'win32' ? 'gpu-engine.exe' : 'gpu-engine'
  const candidates: string[] = []
  const resources = process.resourcesPath
  if (typeof resources === 'string' && resources !== '') {
    candidates.push(join(resources, name), join(resources, 'gpu-engine', name))
  }
  const here = dirname(process.argv[1] ?? '')
  if (here !== '') {
    candidates.push(join(here, name))
    candidates.push(join(here, '..', '..', 'gpu-engine', 'target', 'release', name))
    candidates.push(join(here, '..', '..', '..', 'gpu-engine', 'target', 'release', name))
  }
  candidates.push(join(process.cwd(), 'gpu-engine', 'target', 'release', name))
  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return null
}
