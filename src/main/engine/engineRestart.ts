/** Crash-loop guard for the engine host utilityProcess. */

export const ENGINE_RESTART_DELAY_MS = 400
export const ENGINE_CRASH_WINDOW_MS = 15_000
export const ENGINE_MAX_CRASHES = 5

export interface CrashRecord {
  timestamps: number[]
  restart: boolean
}

/** Record an unexpected engine exit. `restart` is false after too many crashes in the window. */
export function recordEngineCrash(timestamps: number[], now: number): CrashRecord {
  const recent = timestamps.filter((t) => now - t < ENGINE_CRASH_WINDOW_MS)
  recent.push(now)
  return { timestamps: recent, restart: recent.length <= ENGINE_MAX_CRASHES }
}
