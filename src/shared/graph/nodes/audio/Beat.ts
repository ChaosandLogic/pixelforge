import { floatParam, type NodeTypeDef } from '../../types'

export const BEAT_NODE_TYPE = 'audio/beat'

/** Onset / beat pulse from audio analysis (device or file). */
export const Beat: NodeTypeDef = {
  type: BEAT_NODE_TYPE,
  label: 'Beat',
  category: 'audio',
  description: 'Beat/onset pulse from audio — wire trigger to Sequence or Strobe',
  inputs: [],
  outputs: [
    { name: 'value', label: 'Pulse', type: 'float' },
    { name: 'trigger', label: 'Trigger', type: 'trigger' }
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
    { name: 'monitor', label: 'Monitor', type: 'boolean', default: false },
    { name: 'sensitivity', label: 'Sensitivity', type: 'float', default: 1.5, min: 0.5, max: 4, step: 0.1 }
  ],
  evaluate(_inputs, params, ctx) {
    const levels = ctx.getAudioLevels(ctx.nodeId)
    const beat = levels?.beat ?? 0
    const sensitivity = floatParam(params, 'sensitivity', 1.5)
    ctx.pulseTrigger('trigger', beat, 0.45 / sensitivity)
    return { value: beat }
  }
}

export const BEAT_INLINE_PARAMS = new Set(['source', 'device', 'file', 'monitor'])
