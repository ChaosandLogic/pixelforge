import { applyEdgeMode, remapScopedStrip } from '../../pixelScope'
import { floatParam, pixelsInput, stringParam, type NodeTypeDef } from '../../types'

/** Zooms the pixel pattern about a centre point (nearest-neighbour, 1D). */
export const Scale: NodeTypeDef = {
  type: 'transform/scale',
  label: 'Scale',
  category: 'transform',
  description: 'Zooms the pattern about a centre point',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'scale', label: 'Scale', type: 'float', default: 1, min: 0.1, max: 10, step: 0.05 },
    { name: 'centre', label: 'Centre', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
    { name: 'edges', label: 'Edges', type: 'select', default: 'wrap', options: ['wrap', 'clamp'] }
  ],
  gpu: { pass: 'transform/scale' },
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    if (src === null) {
      const out = ctx.acquire()
      out.fill(0)
      return { pixels: out }
    }

    const scale = Math.max(0.001, floatParam(params, 'scale', 1))
    const centre = floatParam(params, 'centre', 0.5)
    const wrap = stringParam(params, 'edges', 'wrap') === 'wrap'

    return {
      pixels: remapScopedStrip(src, ctx, (_i, u) => {
        const v = (u - centre) / scale + centre
        return wrap ? applyEdgeMode(v, 'wrap') : applyEdgeMode(v, 'clamp')
      })
    }
  }
}
