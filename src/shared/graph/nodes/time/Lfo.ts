import { floatParam, stringParam, type NodeTypeDef } from '../../types'

/**
 * Low-frequency oscillator with a float output — wire it into any float
 * input (Mix amount, Mask offset) to animate it.
 */
export const Lfo: NodeTypeDef = {
  type: 'time/lfo',
  label: 'LFO',
  category: 'time',
  description: 'Oscillating float value (sine/square/saw/triangle)',
  inputs: [],
  outputs: [{ name: 'value', label: 'Value', type: 'float' }],
  params: [
    {
      name: 'waveform',
      label: 'Waveform',
      type: 'select',
      default: 'sine',
      options: ['sine', 'square', 'saw', 'triangle']
    },
    { name: 'frequency', label: 'Frequency (Hz)', type: 'float', default: 0.25, min: 0.01, max: 10, step: 0.01 },
    { name: 'phase', label: 'Phase', type: 'float', default: 0, min: 0, max: 1, step: 0.01 },
    { name: 'min', label: 'Min', type: 'float', default: 0, min: -1, max: 1, step: 0.01 },
    { name: 'max', label: 'Max', type: 'float', default: 1, min: -1, max: 2, step: 0.01 }
  ],
  evaluate(_inputs, params, ctx) {
    const frequency = floatParam(params, 'frequency', 0.25)
    const phaseOffset = floatParam(params, 'phase')
    const lo = floatParam(params, 'min', 0)
    const hi = floatParam(params, 'max', 1)

    const t = (ctx.timeMs / 1000) * frequency + phaseOffset
    const phase = t - Math.floor(t)

    let v: number
    switch (stringParam(params, 'waveform', 'sine')) {
      case 'square':
        v = phase < 0.5 ? 1 : 0
        break
      case 'saw':
        v = phase
        break
      case 'triangle':
        v = phase < 0.5 ? phase * 2 : 2 - phase * 2
        break
      default:
        v = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2)
    }

    return { value: lo + (hi - lo) * v }
  }
}
