export type TransitionType = 'cut' | 'crossfade' | 'dissolve' | 'wipe'
export type TransitionCurve = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

export interface SequenceTransition {
  type: TransitionType
  /** Transition length in beats (ignored for cut). */
  duration: number
  curve: TransitionCurve
}

export interface SequenceSegment {
  id: string
  /** Hold duration in beats before transitioning to the next segment. */
  duration: number
  transition: SequenceTransition
}

export interface SequencePlayback {
  /** Segment index(es) to pull-evaluate — one, or two during a transition. */
  activeIndices: number[]
  /** Blend progress toward activeIndices[1] (0..1). */
  blendT: number
  /** Active transition blend mode (crossfade when solo). */
  transitionType: TransitionType
}

export const MAX_SEQUENCE_SEGMENTS = 16

export function defaultSegments(): SequenceSegment[] {
  return [
    {
      id: 'seg0',
      duration: 4,
      transition: { type: 'crossfade', duration: 1, curve: 'ease-in-out' }
    },
    {
      id: 'seg1',
      duration: 4,
      transition: { type: 'crossfade', duration: 1, curve: 'ease-in-out' }
    }
  ]
}

export function parseSegments(raw: unknown): SequenceSegment[] {
  if (!Array.isArray(raw)) return defaultSegments()
  const segments: SequenceSegment[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const s = item as Record<string, unknown>
    const trans = s['transition']
    const t = typeof trans === 'object' && trans !== null ? (trans as Record<string, unknown>) : {}
    segments.push({
      id: typeof s['id'] === 'string' ? s['id'] : `seg${segments.length}`,
      duration: Math.max(0.25, Number(s['duration']) || 4),
      transition: {
        type: (t['type'] as TransitionType) ?? 'crossfade',
        duration: Math.max(0, Number(t['duration']) || 1),
        curve: (t['curve'] as TransitionCurve) ?? 'ease-in-out'
      }
    })
    if (segments.length >= MAX_SEQUENCE_SEGMENTS) break
  }
  return segments.length > 0 ? segments : defaultSegments()
}

export function segmentPortName(index: number): string {
  return `segment_${index}`
}
