import type { ColourValue, ParamValues } from '../graph/types'

export interface GradientStop {
  id: string
  /** 0..1 position along the ramp. */
  position: number
  colour: ColourValue
}

export const MAX_GRADIENT_STOPS = 16

export function defaultGradientStops(): GradientStop[] {
  return [
    { id: 'a', position: 0, colour: { r: 255, g: 80, b: 0 } },
    { id: 'b', position: 1, colour: { r: 30, g: 60, b: 255 } }
  ]
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function parseStop(raw: unknown, index: number): GradientStop | null {
  if (typeof raw !== 'object' || raw === null) return null
  const s = raw as Record<string, unknown>
  const colour = s['colour'] ?? s['color']
  if (typeof colour !== 'object' || colour === null || !('r' in colour)) return null
  const c = colour as ColourValue
  const position = typeof s['position'] === 'number' ? clamp01(s['position']) : index
  const id = typeof s['id'] === 'string' && s['id'] !== '' ? s['id'] : `stop${index}`
  return {
    id,
    position,
    colour: {
      r: Math.max(0, Math.min(255, Math.round(c.r))),
      g: Math.max(0, Math.min(255, Math.round(c.g))),
      b: Math.max(0, Math.min(255, Math.round(c.b)))
    }
  }
}

/** Normalise stored stops; migrate legacy from/to params when present. */
export function parseGradientStops(raw: unknown, params?: ParamValues): GradientStop[] {
  const stops: GradientStop[] = []
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length && stops.length < MAX_GRADIENT_STOPS; i++) {
      const stop = parseStop(raw[i], i)
      if (stop !== null) stops.push(stop)
    }
  }

  if (stops.length >= 2) {
    stops.sort((a, b) => a.position - b.position)
    return stops
  }

  if (params !== undefined) {
    const from = params['from']
    const to = params['to']
    if (
      typeof from === 'object' &&
      from !== null &&
      'r' in from &&
      typeof to === 'object' &&
      to !== null &&
      'r' in to
    ) {
      return [
        { id: 'a', position: 0, colour: { ...(from as ColourValue) } },
        { id: 'b', position: 1, colour: { ...(to as ColourValue) } }
      ]
    }
  }

  return defaultGradientStops()
}

export function fract(v: number): number {
  return v - Math.floor(v)
}

/** Ping-pong repeat 0..1 (TouchDesigner mirror). */
export function pingPong(v: number): number {
  const f = fract(v * 0.5) * 2
  return f <= 1 ? f : 2 - f
}

/** Map spatial axis sample to gradient lookup coordinate. */
export function mapGradientPosition(
  u: number,
  offset: number,
  scale: number,
  phase: number,
  mirror: boolean
): number {
  let t = (u + offset) * scale + phase
  if (mirror) t = pingPong(t)
  else t = fract(t)
  return clamp01(t)
}

/** RGB lerp between parsed stops (for UI stop insertion preview). */
export function sampleGradientStopsRgb(stops: GradientStop[], t: number): ColourValue {
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  if (sorted.length === 0) return { r: 0, g: 0, b: 0 }
  const u = clamp01(t)
  if (u <= sorted[0]!.position) return { ...sorted[0]!.colour }
  const last = sorted[sorted.length - 1]!
  if (u >= last.position) return { ...last.colour }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!
    const b = sorted[i + 1]!
    if (u < a.position || u > b.position) continue
    const span = b.position - a.position
    const f = span > 0 ? (u - a.position) / span : 0
    return {
      r: Math.round(a.colour.r + (b.colour.r - a.colour.r) * f),
      g: Math.round(a.colour.g + (b.colour.g - a.colour.g) * f),
      b: Math.round(a.colour.b + (b.colour.b - a.colour.b) * f)
    }
  }
  return { ...last.colour }
}
