import { floatParam, pixelsInput, type NodeTypeDef } from '../../types'

export const Levels: NodeTypeDef = {
  type: 'colour/levels',
  label: 'Levels',
  category: 'colour',
  description: 'Brightness, contrast and gamma',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'brightness', label: 'Brightness', type: 'float', default: 1, min: 0, max: 2, step: 0.01 },
    { name: 'contrast', label: 'Contrast', type: 'float', default: 1, min: 0, max: 3, step: 0.01 },
    { name: 'gamma', label: 'Gamma', type: 'float', default: 1, min: 0.2, max: 4, step: 0.05 }
  ],
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }

    const brightness = floatParam(params, 'brightness', 1)
    const contrast = floatParam(params, 'contrast', 1)
    const invGamma = 1 / Math.max(0.001, floatParam(params, 'gamma', 1))

    for (let i = 0; i < ctx.pixelCount * 3; i++) {
      let v = (src[i] as number) * brightness
      v = (v - 0.5) * contrast + 0.5
      v = v < 0 ? 0 : v > 1 ? 1 : v
      out[i] = Math.pow(v, invGamma)
    }
    return { pixels: out }
  }
}
