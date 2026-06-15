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
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }

    const n = ctx.pixelCount
    const scale = Math.max(0.001, floatParam(params, 'scale', 1))
    const centre = floatParam(params, 'centre', 0.5)
    const wrap = stringParam(params, 'edges', 'wrap') === 'wrap'
    const denom = Math.max(1, n - 1)

    for (let i = 0; i < n; i++) {
      const u = i / denom
      const v = (u - centre) / scale + centre
      let j = Math.round(v * denom)
      if (wrap) {
        j %= n
        if (j < 0) j += n
      } else {
        j = j < 0 ? 0 : j >= n ? n - 1 : j
      }
      out[i * 3] = src[j * 3] ?? 0
      out[i * 3 + 1] = src[j * 3 + 1] ?? 0
      out[i * 3 + 2] = src[j * 3 + 2] ?? 0
    }
    return { pixels: out }
  }
}
