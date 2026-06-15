import { blendOver } from '../../compositing/blend'
import { floatInput, pixelsInput, type NodeTypeDef } from '../../types'

export const Over: NodeTypeDef = {
  type: 'composite/over',
  label: 'Over',
  category: 'composite',
  description: 'Composites B over A (Oklab blend)',
  inputs: [
    { name: 'a', label: 'A (back)', type: 'pixels' },
    { name: 'b', label: 'B (front)', type: 'pixels' },
    { name: 'opacity', label: 'Opacity', type: 'float' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'opacity', label: 'Opacity', type: 'float', default: 1, min: 0, max: 1, step: 0.01 }
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
      out.set(a ?? (b as Float32Array))
      return { pixels: out }
    }
    const opacity = Math.max(0, Math.min(1, floatInput(inputs, params, 'opacity', 1)))
    blendOver(a, b, opacity, out)
    return { pixels: out }
  }
}
