import { blendAdd } from '../../compositing/blend'
import { copyScopedPixels, pixelsForBlend } from '../../pixelScope'
import { floatInput, pixelsInput, type NodeTypeDef } from '../../types'

export const Add: NodeTypeDef = {
  type: 'composite/add',
  label: 'Add',
  category: 'composite',
  description: 'Adds two pixel streams',
  inputs: [
    { name: 'a', label: 'A', type: 'pixels' },
    { name: 'b', label: 'B', type: 'pixels' },
    { name: 'amount', label: 'Amount', type: 'float' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'amount', label: 'Amount', type: 'float', default: 1, min: 0, max: 1, step: 0.01 }
  ],
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
    const amount = Math.max(0, Math.min(1, floatInput(inputs, params, 'amount', 1)))
    blendAdd(pixelsForBlend(a, ctx)!, pixelsForBlend(b, ctx)!, amount, out)
    return { pixels: out }
  }
}
