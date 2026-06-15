import { oklabToSrgb, srgbToOklab } from '../colour/oklab'
import type { SequencePlayback, SequenceSegment, SequenceTransition, TransitionCurve } from './types'

const labA = new Float32Array(3)
const labB = new Float32Array(3)

function applyTransitionCurve(t: number, curve: TransitionCurve): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  switch (curve) {
    case 'ease-in':
      return u * u
    case 'ease-out':
      return u * (2 - u)
    case 'ease-in-out':
      return u < 0.5 ? 2 * u * u : -1 + (4 - 2 * u) * u
    default:
      return u
  }
}

/**
 * Transition when entering segment `index` from the previous segment.
 * Segment 0 uses its transition only for loop-wrap (last → first).
 */
export function transitionInto(segments: SequenceSegment[], index: number): SequenceTransition | null {
  if (index < 0 || index >= segments.length) return null
  return segments[index]!.transition
}

function incomingDuration(transition: SequenceTransition | null): number {
  if (transition === null || transition.type === 'cut') return 0
  return transition.duration
}

/** Total sequence length in beats (transitions overlap). */
function sequenceLengthBeats(segments: SequenceSegment[]): number {
  if (segments.length === 0) return 0
  let time = 0
  for (const seg of segments) {
    time += seg.duration
  }
  for (let i = 1; i < segments.length; i++) {
    time -= incomingDuration(transitionInto(segments, i))
  }
  return time
}

/** Beat offset where segment i begins. */
export function segmentStartBeat(segments: SequenceSegment[], index: number): number {
  let time = 0
  for (let i = 0; i < index && i < segments.length; i++) {
    time += segments[i]!.duration
  }
  for (let i = 1; i <= index && i < segments.length; i++) {
    time -= incomingDuration(transitionInto(segments, i))
  }
  return time
}

/** Map a beat position to active segment(s) and blend factor. */
export function computePlayback(segments: SequenceSegment[], beat: number, loop: boolean): SequencePlayback {
  if (segments.length === 0) return { activeIndices: [], blendT: 0, transitionType: 'cut' }

  const total = sequenceLengthBeats(segments)
  if (total <= 0) return { activeIndices: [0], blendT: 0, transitionType: 'cut' }

  let pos = beat
  if (loop) pos = ((beat % total) + total) % total
  else if (pos >= total) return { activeIndices: [segments.length - 1], blendT: 0, transitionType: 'cut' }
  else if (pos < 0) return { activeIndices: [0], blendT: 0, transitionType: 'cut' }

  // Loop wrap: last segment → first, using segment 0's transition.
  if (loop && segments.length > 1) {
    const wrapTrans = transitionInto(segments, 0)
    const wrapDur = incomingDuration(wrapTrans)
    if (wrapDur > 0) {
      const wrapStart = total - wrapDur
      if (pos >= wrapStart) {
        const rawT = (pos - wrapStart) / wrapDur
        return {
          activeIndices: [segments.length - 1, 0],
          blendT: applyTransitionCurve(rawT, wrapTrans!.curve),
          transitionType: wrapTrans!.type
        }
      }
    }
  }

  // Incoming crossfades (checked before solo windows — segments overlap here).
  for (let i = 1; i < segments.length; i++) {
    const incoming = transitionInto(segments, i)
    const transDur = incomingDuration(incoming)
    if (transDur <= 0) continue
    const segStart = segmentStartBeat(segments, i)
    if (pos >= segStart && pos < segStart + transDur) {
      const rawT = (pos - segStart) / transDur
      return {
        activeIndices: [i - 1, i],
        blendT: applyTransitionCurve(rawT, incoming!.curve),
        transitionType: incoming!.type
      }
    }
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    const segStart = segmentStartBeat(segments, i)
    const segEnd = segStart + seg.duration
    if (pos >= segStart && pos < segEnd) {
      return { activeIndices: [i], blendT: 0, transitionType: 'cut' }
    }
  }

  return { activeIndices: [segments.length - 1], blendT: 0, transitionType: 'cut' }
}

function pixelHash(index: number): number {
  const s = Math.sin(index * 127.1 + 311.7) * 43758.5453123
  return s - Math.floor(s)
}

function blendWeight(h: number, edge: number, soft: number): number {
  const lo = edge - soft
  const hi = edge + soft
  if (h <= lo) return 1
  if (h >= hi) return 0
  return 1 - (h - lo) / (hi - lo)
}

/** Per-pixel noise-threshold dissolve (stable hash per pixel index). */
export function blendPixelsDissolve(a: Float32Array, b: Float32Array, t: number, out: Float32Array): void {
  const amount = t < 0 ? 0 : t > 1 ? 1 : t
  const soft = 0.08
  const n = out.length / 3
  for (let i = 0; i < n; i++) {
    const w = blendWeight(pixelHash(i), amount, soft)
    const o = i * 3
    const ar = a[o] as number
    const ag = a[o + 1] as number
    const ab = a[o + 2] as number
    const br = b[o] as number
    const bg = b[o + 1] as number
    const bb = b[o + 2] as number
    out[o] = ar * (1 - w) + br * w
    out[o + 1] = ag * (1 - w) + bg * w
    out[o + 2] = ab * (1 - w) + bb * w
  }
}

/** Horizontal wipe along patch u coordinate. */
export function blendPixelsWipe(
  a: Float32Array,
  b: Float32Array,
  t: number,
  positions: Float32Array,
  out: Float32Array
): void {
  const amount = t < 0 ? 0 : t > 1 ? 1 : t
  const soft = 0.04
  const n = out.length / 3
  for (let i = 0; i < n; i++) {
    const u = positions[i * 3] ?? 0
    const w = blendWeight(u, amount, soft)
    const o = i * 3
    const ar = a[o] as number
    const ag = a[o + 1] as number
    const ab = a[o + 2] as number
    const br = b[o] as number
    const bg = b[o + 1] as number
    const bb = b[o + 2] as number
    out[o] = ar * (1 - w) + br * w
    out[o + 1] = ag * (1 - w) + bg * w
    out[o + 2] = ab * (1 - w) + bb * w
  }
}

/** Oklab crossfade of two equal-length pixel buffers into out. */
export function blendPixelsOklab(a: Float32Array, b: Float32Array, t: number, out: Float32Array): void {
  const amount = t < 0 ? 0 : t > 1 ? 1 : t
  const n = out.length
  for (let i = 0; i < n; i += 3) {
    srgbToOklab(a[i] as number, a[i + 1] as number, a[i + 2] as number, labA)
    srgbToOklab(b[i] as number, b[i + 1] as number, b[i + 2] as number, labB)
    const L = labA[0]! + (labB[0]! - labA[0]!) * amount
    const A = labA[1]! + (labB[1]! - labA[1]!) * amount
    const B = labA[2]! + (labB[2]! - labA[2]!) * amount
    oklabToSrgb(L, A, B, out, i)
  }
}
