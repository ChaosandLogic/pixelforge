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
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }

    const translate = floatInput(inputs, params, 'translate')
    const speed = floatParam(params, 'speed')
    const scale = Math.max(0.001, floatParam(params, 'scale', 1))
    const centre = floatParam(params, 'centre', 0.5)
    const flip = params['flip'] === true
    const edges = stringParam(params, 'edges', 'wrap')

    const shift = translate + (ctx.timeMs / 1000) * speed
    const n = ctx.pixelCount
    const denom = Math.max(1, n - 1)

    for (let i = 0; i < n; i++) {
      let u = i / denom
      if (flip) u = 1 - u
      let v = (u - centre) / scale + centre - shift

      if (edges === 'wrap') {
        v -= Math.floor(v)
      } else if (edges === 'mirror') {
        const t = Math.abs(v) % 2
        v = t > 1 ? 2 - t : t
      } else {
        v = v < 0 ? 0 : v > 1 ? 1 : v
      }

      const j = Math.round(v * denom)
      out[i * 3] = src[j * 3] ?? 0
      out[i * 3 + 1] = src[j * 3 + 1] ?? 0
      out[i * 3 + 2] = src[j * 3 + 2] ?? 0
    }
    return { pixels: out }
  }
}
