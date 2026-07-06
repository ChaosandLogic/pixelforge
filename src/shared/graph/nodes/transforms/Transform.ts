import { applyEdgeMode, remapScopedStrip } from '../../pixelScope'
import { floatInput, floatParam, pixelsInput, stringParam, type NodeTypeDef } from '../../types'

/**
 * Combined translate / scale / flip in one node (the TouchDesigner
 * Transform equivalent, 1D until the patch system provides real UVs).
 * 'translate' is a float input port — wire an LFO into it for motion,
 * or use the speed param for continuous scroll.
 */
export const Transform: NodeTypeDef = {
  type: 'transform/transform',
  label: 'Transform',
  category: 'transform',
  description: 'Translate, scale and flip the pattern in one node',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'translate', label: 'Translate', type: 'float' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'translate', label: 'Translate', type: 'float', default: 0, min: -1, max: 1, step: 0.01 },
    { name: 'speed', label: 'Speed', type: 'float', default: 0, min: -5, max: 5, step: 0.05 },
    { name: 'scale', label: 'Scale', type: 'float', default: 1, min: 0.1, max: 10, step: 0.05 },
    { name: 'centre', label: 'Centre', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
    { name: 'flip', label: 'Flip', type: 'boolean', default: false },
    { name: 'edges', label: 'Edges', type: 'select', default: 'wrap', options: ['wrap', 'clamp', 'mirror'] }
  ],
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    if (src === null) {
      const out = ctx.acquire()
      out.fill(0)
      return { pixels: out }
    }

    const translate = floatInput(inputs, params, 'translate')
    const speed = floatParam(params, 'speed')
    const scale = Math.max(0.001, floatParam(params, 'scale', 1))
    const centre = floatParam(params, 'centre', 0.5)
    const flip = params['flip'] === true
    const edges = stringParam(params, 'edges', 'wrap') as 'wrap' | 'clamp' | 'mirror'
    const shift = translate + (ctx.timeMs / 1000) * speed

    return {
      pixels: remapScopedStrip(src, ctx, (_i, u) => {
        let pos = flip ? 1 - u : u
        let v = (pos - centre) / scale + centre - shift
        return applyEdgeMode(v, edges)
      })
    }
  }
}
