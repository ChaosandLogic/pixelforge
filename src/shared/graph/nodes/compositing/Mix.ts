import { blendAdd, blendMix, blendMultiply, blendScreen } from '../../compositing/blend'
import { copyScopedPixels, pixelsForBlend } from '../../pixelScope'
import { floatInput, pixelsInput, stringParam, type NodeTypeDef } from '../../types'

/**
 * Two-input compositor. 'mix' crossfades in Oklab (never lerp in RGB);
 * the arithmetic modes (add/multiply/screen) operate on sRGB values as is
 * conventional, scaled by amount. Drive 'amount' with an LFO for automatic
 * crossfades.
 */
export const Mix: NodeTypeDef = {
  type: 'composite/mix',
  label: 'Mix',
  category: 'composite',
  description: 'Blends two pixel streams (Oklab crossfade or add/multiply/screen)',
  inputs: [
    { name: 'a', label: 'A', type: 'pixels' },
    { name: 'b', label: 'B', type: 'pixels' },
    { name: 'amount', label: 'Amount', type: 'float' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'mode', label: 'Mode', type: 'select', default: 'mix', options: ['mix', 'add', 'multiply', 'screen'] },
    { name: 'amount', label: 'Amount', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 }
  ],
  gpu: { pass: 'composite/mix' },
  evaluate(inputs, params, ctx) {
    const a = pixelsInput(inputs, 'a')
    const b = pixelsInput(inputs, 'b')
    const out = ctx.acquire()

    if (a === null && b === null) {
      out.fill(0)
      return { pixels: out }
    }
    if (a === null || b === null) {
      return { pixels: copyScopedPixels((a ?? b) as Float32Array, ctx) }
    }

    const mode = stringParam(params, 'mode', 'mix')
    const amount = Math.max(0, Math.min(1, floatInput(inputs, params, 'amount', 0.5)))
    const aFull = pixelsForBlend(a, ctx)!
    const bFull = pixelsForBlend(b, ctx)!

    switch (mode) {
      case 'add':
        blendAdd(aFull, bFull, amount, out)
        break
      case 'multiply':
        blendMultiply(aFull, bFull, amount, out)
        break
      case 'screen':
        blendScreen(aFull, bFull, amount, out)
        break
      default:
        blendMix(aFull, bFull, amount, out)
    }
    return { pixels: out }
  }
}
