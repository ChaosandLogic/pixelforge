import { colourParam, floatParam, type NodeTypeDef } from '../../types'
import { beginScopedOutput, generatorScope, scopePatchIndex } from '../../generatorScope'

export const Strobe: NodeTypeDef = {
  type: 'generator/strobe',
  label: 'Strobe',
  category: 'generator',
  description: 'Flashes between two colours at a fixed rate',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'colour', label: 'Colour', type: 'colour', default: { r: 255, g: 255, b: 255 } },
    { name: 'offColour', label: 'Off Colour', type: 'colour', default: { r: 0, g: 0, b: 0 } },
    { name: 'rate', label: 'Rate (Hz)', type: 'float', default: 4, min: 0.1, max: 20, step: 0.1 },
    { name: 'duty', label: 'Duty', type: 'float', default: 0.5, min: 0.05, max: 0.95, step: 0.05 }
  ],
  evaluate(inputs, params, ctx) {
    const on = colourParam(params, 'colour')
    const off = colourParam(params, 'offColour')
    const rate = floatParam(params, 'rate', 4)
    const duty = floatParam(params, 'duty', 0.5)

    const phase = (ctx.timeMs / 1000) * rate
    const lit = phase - Math.floor(phase) < duty
    const c = lit ? on : off

    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    const r = c.r / 255
    const g = c.g / 255
    const b = c.b / 255
    for (let i = 0; i < scope.count; i++) {
      const dst = scopePatchIndex(scope, i) * 3
      out[dst] = r
      out[dst + 1] = g
      out[dst + 2] = b
    }
    return { pixels: out }
  }
}
