import { colourParam, type NodeTypeDef } from '../../types'
import { beginScopedOutput, generatorScope, scopePatchIndex } from '../../generatorScope'

export const SolidColour: NodeTypeDef = {
  type: 'generator/solid-colour',
  label: 'Solid Colour',
  category: 'generator',
  description: 'Fills every pixel with one colour',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [{ name: 'colour', label: 'Colour', type: 'colour', default: { r: 255, g: 80, b: 0 } }],
  evaluate(inputs, params, ctx) {
    const { r, g, b } = colourParam(params, 'colour')
    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    const fr = r / 255
    const fg = g / 255
    const fb = b / 255
    for (let i = 0; i < scope.count; i++) {
      const off = scopePatchIndex(scope, i) * 3
      out[off] = fr
      out[off + 1] = fg
      out[off + 2] = fb
    }
    return { pixels: out }
  }
}
