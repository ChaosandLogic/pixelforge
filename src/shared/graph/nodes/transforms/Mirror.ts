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
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }

    const n = ctx.pixelCount
    const mode = stringParam(params, 'mode', 'fold')
    for (let i = 0; i < n; i++) {
      let j: number
      if (mode === 'flip') {
        j = n - 1 - i
      } else {
        j = i < n / 2 ? i : n - 1 - i
      }
      out[i * 3] = src[j * 3] ?? 0
      out[i * 3 + 1] = src[j * 3 + 1] ?? 0
      out[i * 3 + 2] = src[j * 3 + 2] ?? 0
    }
    return { pixels: out }
  }
}
