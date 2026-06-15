import { pixelsInput, floatParam, type NodeTypeDef } from '../../types'

/** Simple tone curve: shadows / midtones / highlights remapping. */
export const Curves: NodeTypeDef = {
  type: 'colour/curves',
  label: 'Curves',
  category: 'colour',
  description: 'Shadows, midtones and highlights tone curve',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'shadows', label: 'Shadows', type: 'float', default: 0, min: -1, max: 1, step: 0.01 },
    { name: 'midtones', label: 'Midtones', type: 'float', default: 0, min: -1, max: 1, step: 0.01 },
    { name: 'highlights', label: 'Highlights', type: 'float', default: 0, min: -1, max: 1, step: 0.01 }
  ],
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }

    const shadows = floatParam(params, 'shadows')
    const midtones = floatParam(params, 'midtones')
    const highlights = floatParam(params, 'highlights')

    for (let i = 0; i < ctx.pixelCount * 3; i++) {
      let v = src[i] as number
      if (v < 0.33) v += shadows * (0.33 - v)
      else if (v < 0.66) v += midtones * (0.5 - Math.abs(v - 0.5))
      else v += highlights * (v - 0.66)
      out[i] = v < 0 ? 0 : v > 1 ? 1 : v
    }
    return { pixels: out }
  }
}
