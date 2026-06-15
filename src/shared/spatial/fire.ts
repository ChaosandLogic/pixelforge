import { valueNoise3D } from './noise'

function heatColor(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t))
  if (x < 0.25) {
    const k = x / 0.25
    return [k * 0.4, 0, 0]
  }
  if (x < 0.5) {
    const k = (x - 0.25) / 0.25
    return [0.4 + k * 0.6, k * 0.15, 0]
  }
  if (x < 0.75) {
    const k = (x - 0.5) / 0.25
    return [1, 0.15 + k * 0.55, k * 0.05]
  }
  const k = (x - 0.75) / 0.25
  return [1, 0.7 + k * 0.3, 0.05 + k * 0.95]
}

export interface FireSampleOptions {
  u: number
  v: number
  timeSec: number
  scale: number
  speed: number
  turbulence: number
  /** Bias flames toward bottom of V (0=top, 1=bottom) */
  rise: number
}

export function sampleFire(opts: FireSampleOptions): [number, number, number] {
  const { u, v, timeSec, scale, speed, turbulence, rise } = opts
  const nx = u * scale
  const ny = v * scale - timeSec * speed
  const nz = timeSec * 0.35

  let heat = valueNoise3D(nx, ny, nz)
  heat += turbulence * 0.5 * valueNoise3D(nx * 2.3 + 17, ny * 1.7, nz * 1.1)
  heat += (1 - v) * rise
  heat -= v * 0.35

  return heatColor(heat)
}
