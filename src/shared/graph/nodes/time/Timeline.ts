import { floatParam, stringParam, type NodeData, type NodeTypeDef, type ParamValues } from '../../types'

export const TIMELINE_NODE_TYPE = 'time/timeline'

const MIN_PERIOD_SEC = 0.05
const MAX_PERIOD_SEC = 3600

export interface TimelineLoop {
  loopBeats: number
  loopSec: number
}

function nodeFloat(params: ParamValues, name: string, fallback: number): number {
  const value = params[name]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function resolveParams(node: NodeData | ParamValues): ParamValues {
  if (typeof node === 'object' && node !== null && 'params' in node) {
    return (node as NodeData).params
  }
  return node as ParamValues
}

/** Resolve loop length in beats and seconds from Timeline params. */
export function timelineLoop(node: NodeData | ParamValues): TimelineLoop {
  const params = resolveParams(node)
  const mode = stringParam(params, 'durationMode', 'seconds')
  const bpm = Math.max(1, nodeFloat(params, 'bpm', 120))

  if (mode === 'beats') {
    const loopBeats = Math.max(0.25, nodeFloat(params, 'durationBeats', 8))
    return { loopBeats, loopSec: (loopBeats / bpm) * 60 }
  }

  const loopSec = Math.max(MIN_PERIOD_SEC, nodeFloat(params, 'durationSec', 8))
  return { loopBeats: (loopSec / 60) * bpm, loopSec }
}

/** Loop period in seconds for export when Timeline looping is enabled. */
export function timelineLoopPeriodSec(node: NodeData | ParamValues): number | null {
  const params = resolveParams(node)
  if (params['loop'] === false) return null
  const { loopSec } = timelineLoop(node)
  if (loopSec < MIN_PERIOD_SEC || loopSec > MAX_PERIOD_SEC) return null
  return loopSec
}

/** Compute phase 0..1 and loop index from a raw beat position. */
export function timelinePhase(
  rawBeat: number,
  loopBeats: number,
  loop: boolean
): { phase: number; loopIndex: number } {
  if (loopBeats <= 0) return { phase: 0, loopIndex: 0 }
  if (loop) {
    const wrapped = ((rawBeat % loopBeats) + loopBeats) % loopBeats
    const loopIndex = Math.floor(rawBeat / loopBeats)
    return { phase: wrapped / loopBeats, loopIndex }
  }
  const phase = Math.min(1, Math.max(0, rawBeat / loopBeats))
  return { phase, loopIndex: rawBeat >= loopBeats ? 1 : 0 }
}

export const Timeline: NodeTypeDef = {
  type: TIMELINE_NODE_TYPE,
  label: 'Timeline',
  category: 'time',
  description:
    'Master show loop clock — wire beat into Sequence, phase into generators (set speed 0), loop trigger into Ramp/Hold',
  inputs: [{ name: 'reset', label: 'Reset', type: 'trigger' }],
  outputs: [
    { name: 'beat', label: 'Beat', type: 'float' },
    { name: 'phase', label: 'Phase', type: 'float' },
    { name: 'time', label: 'Time', type: 'float' },
    { name: 'loop', label: 'Loop', type: 'trigger' }
  ],
  params: [
    {
      name: 'durationMode',
      label: 'Duration mode',
      type: 'select',
      default: 'seconds',
      options: ['seconds', 'beats']
    },
    { name: 'durationSec', label: 'Duration (s)', type: 'float', default: 8, min: 0.05, max: 3600, step: 0.1 },
    { name: 'durationBeats', label: 'Duration (beats)', type: 'float', default: 8, min: 0.25, max: 4096, step: 0.25 },
    { name: 'bpm', label: 'BPM', type: 'float', default: 120, min: 20, max: 300, step: 1 },
    { name: 'loop', label: 'Loop', type: 'boolean', default: true },
    { name: 'offset', label: 'Beat offset', type: 'float', default: 0, min: -64, max: 64, step: 0.25 }
  ],
  evaluate(_inputs, params, ctx) {
    const bpm = floatParam(params, 'bpm', 120)
    const offset = floatParam(params, 'offset', 0)
    const loop = params['loop'] !== false
    const { loopBeats, loopSec } = timelineLoop(params)

    const autoBeat = (ctx.timeMs / 60000) * bpm + offset

    if (ctx.consumeTrigger(ctx.nodeId, 'reset')) {
      const beatOffset = ctx.getSequenceBeatOffset(ctx.nodeId)
      ctx.setSequenceBeatOffset(ctx.nodeId, beatOffset - autoBeat)
    }

    const rawBeat = autoBeat + ctx.getSequenceBeatOffset(ctx.nodeId)
    const { phase, loopIndex } = timelinePhase(rawBeat, loopBeats, loop)

    if (loop) {
      ctx.advanceTimelineLoop(loopIndex)
    }

    return {
      beat: rawBeat,
      phase,
      time: phase * loopSec
    }
  }
}
