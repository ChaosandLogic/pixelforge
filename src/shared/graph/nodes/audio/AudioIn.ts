import { floatParam, stringParam, type NodeTypeDef, type ParamValues } from '../../types'

export const AUDIO_IN_NODE_TYPE = 'audio/audio-in'

export const AudioIn: NodeTypeDef = {
  type: AUDIO_IN_NODE_TYPE,
  label: 'Audio In',
  category: 'audio',
  description: 'Analyzes live input or an audio file into low/mid/high bands',
  inputs: [],
  outputs: [
    { name: 'low', label: 'Low', type: 'float' },
    { name: 'mid', label: 'Mid', type: 'float' },
    { name: 'high', label: 'High', type: 'float' }
  ],
  params: [
    {
      name: 'source',
      label: 'Source',
      type: 'select',
      default: 'device',
      options: ['device', 'file']
    },
    { name: 'device', label: 'Device', type: 'select', default: '', options: [''] },
    { name: 'file', label: 'File', type: 'file', default: '' },
    { name: 'monitor', label: 'Monitor', type: 'boolean', default: true },
    { name: 'lowMax', label: 'Low max (Hz)', type: 'float', default: 250, min: 40, max: 2000, step: 10 },
    { name: 'midMax', label: 'Mid max (Hz)', type: 'float', default: 4000, min: 500, max: 16000, step: 50 },
    { name: 'gain', label: 'Gain', type: 'float', default: 1, min: 0, max: 4, step: 0.05 },
    { name: 'attack', label: 'Attack (s)', type: 'float', default: 0.01, min: 0.001, max: 1, step: 0.001 },
    { name: 'release', label: 'Release (s)', type: 'float', default: 0.25, min: 0.01, max: 2, step: 0.01 }
  ],
  evaluate(_inputs, params, ctx) {
    const levels = ctx.getAudioLevels(ctx.nodeId)
    const gain = floatParam(params, 'gain', 1)
    const scale = (v: number): number => Math.max(0, Math.min(1, v * gain))

    if (levels === null) {
      return { low: 0, mid: 0, high: 0 }
    }

    return {
      low: scale(levels.low),
      mid: scale(levels.mid),
      high: scale(levels.high)
    }
  }
}

/** Params edited inline on the custom node UI rather than the inspector. */
export const AUDIO_IN_INLINE_PARAMS = new Set(['source', 'device', 'file', 'monitor'])

export function audioSourceMode(params: ParamValues): 'device' | 'file' {
  return stringParam(params, 'source', 'device') === 'file' ? 'file' : 'device'
}
