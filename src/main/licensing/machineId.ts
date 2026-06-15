import { createHash } from 'node:crypto'
import { hostname } from 'node:os'

let cachedId: string | null = null

/** Stable machine identifier for license binding. */
export async function getMachineId(): Promise<string> {
  if (cachedId !== null) return cachedId
  try {
    const { machineIdSync } = await import('node-machine-id')
    cachedId = machineIdSync(true)
    return cachedId
  } catch {
    const fallback = createHash('sha256').update(`${hostname()}-${process.platform}`).digest('hex').slice(0, 32)
    cachedId = fallback
    return fallback
  }
}
