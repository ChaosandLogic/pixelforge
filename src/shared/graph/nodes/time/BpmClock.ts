import { floatParam, type NodeTypeDef } from '../../types'

/** Continuous beat counter from session start, driven by BPM. */
export const BpmClock: NodeTypeDef = {
  type: 'time/bpm-clock',
  label: 'BPM Clock',
  category: 'time',
  description: 'Beat counter — prefer Timeline for show loops and export',
  inputs: [],
  outputs: [{ name: 'beat', label: 'Beat', type: 'float' }],
  params: [
    { name: 'bpm', label: 'BPM', type: 'float', default: 120, min: 20, max: 300, step: 1 },
    { name: 'offset', label: 'Beat offset', type: 'float', default: 0, min: -64, max: 64, step: 0.25 }
  ],
  evaluate(_inputs, params, ctx) {
    const bpm = floatParam(params, 'bpm', 120)
    const offset = floatParam(params, 'offset', 0)
    const beat = (ctx.timeMs / 60000) * bpm + offset
    return { beat }
  }
}
