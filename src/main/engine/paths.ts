import { app } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

let cachedMainBundleDir: string | null = null

/**
 * Directory containing main-process entry bundles (index.js, player.js, engineHost.js).
 * Do not use __dirname from code-split chunks — rollup places them under out/main/chunks/.
 *
 * app.getAppPath() differs by launch mode:
 * - electron-vite dev / packaged app: project (or asar) root → out/main/…
 * - electron out/main/player.js: already out/main → engineHost.js is a sibling
 */
export function mainBundleDir(): string {
  if (cachedMainBundleDir !== null) return cachedMainBundleDir

  const appPath = app.getAppPath()

  if (existsSync(join(appPath, 'engineHost.js'))) {
    cachedMainBundleDir = appPath
    return appPath
  }

  const nested = join(appPath, 'out', 'main')
  if (existsSync(join(nested, 'engineHost.js'))) {
    cachedMainBundleDir = nested
    return nested
  }

  const entryDir = dirname(process.argv[1] ?? '')
  if (entryDir !== '' && existsSync(join(entryDir, 'engineHost.js'))) {
    cachedMainBundleDir = entryDir
    return entryDir
  }

  cachedMainBundleDir = nested
  return nested
}

export function engineHostPath(): string {
  return join(mainBundleDir(), 'engineHost.js')
}

export function outputWorkerPath(): string {
  return join(mainBundleDir(), 'outputWorker.js')
}
