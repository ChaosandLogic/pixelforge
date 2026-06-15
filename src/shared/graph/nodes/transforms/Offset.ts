import { floatParam, pixelsInput, type NodeTypeDef } from '../../types'

/**
 * Shifts pixels along the strip with wrap-around. A non-zero speed scrolls
 * continuously — the classic chase.
 */
export const Offset: NodeTypeDef = {
  type: 'transform/offset',
  label: 'Offset',
  category: 'transform',
  description: 'Shifts pixels along the strip (animatable scroll)',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'offset', label: 'Offset', type: 'float', default: 0, min: -1, max: 1, step: 0.01 },
    { name: 'speed', label: 'Speed', type: 'float', default: 0, min: -5, max: 5, step: 0.05 }
  ],
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }

    const n = ctx.pixelCount
    const offset = floatParam(params, 'offset')
    const speed = floatParam(params, 'speed')
    const shiftF = (offset + (ctx.timeMs / 1000) * speed) * n
    const shift = Math.round(shiftF)

    for (let i = 0; i < n; i++) {
      let j = (i - shift) % n
      if (j < 0) j += n
      out[i * 3] = src[j * 3] ?? 0
      out[i * 3 + 1] = src[j * 3 + 1] ?? 0
      out[i * 3 + 2] = src[j * 3 + 2] ?? 0
    }
    return { pixels: out }
  }
}
