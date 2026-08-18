import { mapScopedPixels } from '../../pixelScope'
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
  gpu: { pass: 'colour/curves' },
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    if (src === null) {
      const out = ctx.acquire()
      out.fill(0)
      return { pixels: out }
    }

    const shadows = floatParam(params, 'shadows')
    const midtones = floatParam(params, 'midtones')
    const highlights = floatParam(params, 'highlights')

    return {
      pixels: mapScopedPixels(src, ctx, (r, g, b) => {
        const mapChannel = (v: number): number => {
          if (v < 0.33) v += shadows * (0.33 - v)
          else if (v < 0.66) v += midtones * (0.5 - Math.abs(v - 0.5))
          else v += highlights * (v - 0.66)
          return v < 0 ? 0 : v > 1 ? 1 : v
        }
        return [mapChannel(r), mapChannel(g), mapChannel(b)]
      })
    }
  }
}
