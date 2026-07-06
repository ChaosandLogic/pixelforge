import {
  blendPixelsDissolve,
  blendPixelsOklab,
  blendPixelsWipe,
  computePlayback,
  segmentStartBeat
} from '../../../sequence/evaluate'
import {
  defaultSegments,
  MAX_SEQUENCE_SEGMENTS,
  parseSegments,
  segmentPortName,
  type SequenceSegment
} from '../../../sequence/types'
import { pixelsForBlend } from '../../pixelScope'
import { floatInput, floatParam, type NodeTypeDef, type PortDef } from '../../types'

export const SEQUENCE_NODE_TYPE = 'sequence/sequence'

function segmentInputs(): PortDef[] {
  const inputs: PortDef[] = []
  for (let i = 0; i < MAX_SEQUENCE_SEGMENTS; i++) {
    inputs.push({ name: segmentPortName(i), label: `Segment ${i + 1}`, type: 'pixels' })
  }
  return inputs
}

export const Sequence: NodeTypeDef = {
  type: SEQUENCE_NODE_TYPE,
  label: 'Sequence',
  category: 'sequence',
  description: 'Timed segment playback with Oklab crossfades',
  inputs: [
    ...segmentInputs(),
    { name: 'beat', label: 'Beat', type: 'float' },
    { name: 'clock', label: 'Clock', type: 'trigger' },
    { name: 'reset', label: 'Reset', type: 'trigger' },
    { name: 'intensity', label: 'Intensity', type: 'float' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'bpm', label: 'BPM', type: 'float', default: 120, min: 20, max: 300, step: 1 },
    { name: 'loop', label: 'Loop', type: 'boolean', default: true },
    { name: 'segments', label: 'Segments', type: 'segments', default: defaultSegments() }
  ],
  evaluate(inputs, params, ctx) {
    const segments = parseSegments(params['segments'])
    const bpm = floatParam(params, 'bpm', 120)
    const loop = params['loop'] !== false
    const intensity = Math.max(0, Math.min(1, floatInput(inputs, params, 'intensity', 1)))

    const autoBeat = (ctx.timeMs / 60000) * bpm
    const beatPort = inputs['beat']

    if (ctx.consumeTrigger(ctx.nodeId, 'reset')) {
      const base = typeof beatPort === 'number' ? beatPort : autoBeat
      ctx.setSequenceBeatOffset(ctx.nodeId, -base)
    }
    if (ctx.consumeTrigger(ctx.nodeId, 'clock')) {
      const offset = ctx.getSequenceBeatOffset(ctx.nodeId)
      const currentBeat = (typeof beatPort === 'number' ? beatPort : autoBeat) + offset
      const playback = computePlayback(segments, currentBeat, false)
      const current = playback.activeIndices[0] ?? 0
      const next = Math.min(segments.length - 1, current + 1)
      const nextStart = segmentStartBeat(segments, next)
      const base = typeof beatPort === 'number' ? beatPort : autoBeat
      ctx.setSequenceBeatOffset(ctx.nodeId, nextStart - base)
    }

    const beat =
      (typeof beatPort === 'number' ? beatPort : autoBeat) + ctx.getSequenceBeatOffset(ctx.nodeId)

    const playback = computePlayback(segments, beat, loop)

    if (playback.activeIndices.length === 0) {
      const out = ctx.acquire()
      out.fill(0)
      return { pixels: out }
    }

    const pullSegment = (index: number): Float32Array | null => {
      if (index < 0 || index >= segments.length) return null
      const value = ctx.evalInput(segmentPortName(index))
      // Segments wired from a Fixture emit compact (fixture-scoped) buffers;
      // expand them to full-patch space so `out.set`/blends index correctly.
      return value instanceof Float32Array ? pixelsForBlend(value, ctx) : null
    }

    const out = ctx.acquire()

    if (playback.activeIndices.length === 1) {
      const a = pullSegment(playback.activeIndices[0] as number)
      if (a === null) {
        out.fill(0)
      } else {
        out.set(a)
      }
    } else {
      const a = pullSegment(playback.activeIndices[0] as number)
      const b = pullSegment(playback.activeIndices[1] as number)
      if (a === null && b === null) {
        out.fill(0)
      } else if (a === null) {
        out.set(b as Float32Array)
      } else if (b === null) {
        out.set(a)
      } else {
        switch (playback.transitionType) {
          case 'dissolve':
            blendPixelsDissolve(a, b, playback.blendT, out)
            break
          case 'wipe':
            blendPixelsWipe(a, b, playback.blendT, ctx.positions, out)
            break
          case 'crossfade':
          default:
            blendPixelsOklab(a, b, playback.blendT, out)
            break
        }
      }
    }

    if (intensity < 1) {
      for (let i = 0; i < out.length; i++) {
        out[i] = (out[i] as number) * intensity
      }
    }

    return { pixels: out }
  }
}

export function activeSegmentPorts(segments: SequenceSegment[]): PortDef[] {
  return segments.map((_, i) => ({
    name: segmentPortName(i),
    label: `Segment ${i + 1}`,
    type: 'pixels' as const
  }))
}
