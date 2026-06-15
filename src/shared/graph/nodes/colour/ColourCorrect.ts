import { pixelsInput, floatParam, type NodeTypeDef } from '../../types'

/** Lift / gamma / gain colour correction per channel. */
export const ColourCorrect: NodeTypeDef = {
  type: 'colour/correct',
  label: 'Colour Correct',
  category: 'colour',
  description: 'Lift, gamma and gain per channel',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'lift', label: 'Lift', type: 'float', default: 0, min: -0.5, max: 0.5, step: 0.01 },
    { name: 'gamma', label: 'Gamma', type: 'float', default: 1, min: 0.2, max: 4, step: 0.05 },
    { name: 'gain', label: 'Gain', type: 'float', default: 1, min: 0, max: 3, step: 0.01 },
    { name: 'temperature', label: 'Temperature', type: 'float', default: 0, min: -1, max: 1, step: 0.01 }
  ],
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }

    const lift = floatParam(params, 'lift')
    const invGamma = 1 / Math.max(0.001, floatParam(params, 'gamma', 1))
    const gain = floatParam(params, 'gain', 1)
    const temp = floatParam(params, 'temperature')
    const warmR = 1 + temp * 0.2
    const warmB = 1 - temp * 0.2

    for (let i = 0; i < ctx.pixelCount * 3; i += 3) {
      let r = ((src[i] as number) + lift) * gain * warmR
      let g = ((src[i + 1] as number) + lift) * gain
      let b = ((src[i + 2] as number) + lift) * gain * warmB
      r = Math.pow(r < 0 ? 0 : r > 1 ? 1 : r, invGamma)
      g = Math.pow(g < 0 ? 0 : g > 1 ? 1 : g, invGamma)
      b = Math.pow(b < 0 ? 0 : b > 1 ? 1 : b, invGamma)
      out[i] = r
      out[i + 1] = g
      out[i + 2] = b
    }
    return { pixels: out }
  }
}
