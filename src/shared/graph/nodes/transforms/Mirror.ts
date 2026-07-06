import {
  beginScopedPixelOutput,
  pixelScopeFromSrc,
  readScopedRgb,
  writeScopedRgb
} from '../../pixelScope'
import { pixelsInput, stringParam, type NodeTypeDef } from '../../types'

/**
 * 1D pixel-order mirror (index space until the patch system provides real
 * UV coordinates). 'flip' reverses the strip; 'fold' reflects the first
 * half onto the second.
 */
export const Mirror: NodeTypeDef = {
  type: 'transform/mirror',
  label: 'Mirror',
  category: 'transform',
  description: 'Flips or folds the pixel order',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [{ name: 'mode', label: 'Mode', type: 'select', default: 'fold', options: ['fold', 'flip'] }],
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    if (src === null) {
      const out = ctx.acquire()
      out.fill(0)
      return { pixels: out }
    }

    const scope = pixelScopeFromSrc(src, ctx)
    const out = beginScopedPixelOutput(ctx)
    const mode = stringParam(params, 'mode', 'fold')

    for (let i = 0; i < scope.count; i++) {
      const j =
        mode === 'flip' ? scope.count - 1 - i : i < scope.count / 2 ? i : scope.count - 1 - i
      const [r, g, b] = readScopedRgb(src, scope, j)
      writeScopedRgb(out, scope, i, r, g, b)
    }
    return { pixels: out }
  }
}
