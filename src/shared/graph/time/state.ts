/** Ring buffer of (timeMs, value) samples for float delay nodes. */
export interface DelayBuffer {
  times: number[]
  values: number[]
}

export function pushDelaySample(buf: DelayBuffer, timeMs: number, value: number, maxSamples: number): void {
  buf.times.push(timeMs)
  buf.values.push(value)
  while (buf.times.length > maxSamples) {
    buf.times.shift()
    buf.values.shift()
  }
}

/** Sample delayed value; linear interpolation between bracketing samples. */
export function sampleDelay(buf: DelayBuffer, timeMs: number, delayMs: number): number {
  if (buf.times.length === 0) return 0
  const target = timeMs - delayMs
  if (target <= (buf.times[0] as number)) return buf.values[0] as number

  for (let i = buf.times.length - 1; i >= 0; i--) {
    const t = buf.times[i] as number
    if (t <= target) {
      const v0 = buf.values[i] as number
      const t1 = buf.times[i + 1] as number | undefined
      if (t1 === undefined) return v0
      const v1 = buf.values[i + 1] as number
      const u = (target - t) / (t1 - t)
      return v0 + (v1 - v0) * u
    }
  }
  return buf.values[buf.values.length - 1] as number
}

export interface HoldState {
  value: number
  untilMs: number
}

export function sampleHold(
  state: HoldState,
  timeMs: number,
  input: number,
  holdMs: number,
  retrigger: boolean
): number {
  if (retrigger) {
    state.value = input
    state.untilMs = timeMs + holdMs
  } else if (timeMs > state.untilMs) {
    state.value = input
  }
  return state.value
}

export interface RampState {
  startMs: number
}

export function sampleRamp(
  state: RampState,
  timeMs: number,
  durationMs: number,
  loop: boolean,
  restart: boolean
): number {
  const dur = Math.max(1, durationMs)
  if (restart) state.startMs = timeMs
  const elapsed = timeMs - state.startMs
  if (loop) {
    const phase = ((elapsed % dur) + dur) % dur
    return phase / dur
  }
  return elapsed >= dur ? 1 : elapsed / dur
}
