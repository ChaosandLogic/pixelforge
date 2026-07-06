import {
  beginScopedPixelOutput,
  pixelScopeFromSrc,
  readScopedRgb,
  writeScopedRgb
} from '../../pixelScope'
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
    if (src === null) {
      const out = ctx.acquire()
      out.fill(0)
      return { pixels: out }
    }

    const scope = pixelScopeFromSrc(src, ctx)
    const out = beginScopedPixelOutput(ctx)
    const offset = floatParam(params, 'offset')
    const speed = floatParam(params, 'speed')
    const shift = Math.round((offset + (ctx.timeMs / 1000) * speed) * scope.count)

    for (let i = 0; i < scope.count; i++) {
      let j = (i - shift) % scope.count
      if (j < 0) j += scope.count
      const [r, g, b] = readScopedRgb(src, scope, j)
      writeScopedRgb(out, scope, i, r, g, b)
    }
    return { pixels: out }
  }
}
