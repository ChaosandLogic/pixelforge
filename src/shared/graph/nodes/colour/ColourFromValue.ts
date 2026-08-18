import { OklabRamp } from '../../../colour/oklab'
import {
  beginScopedOutput,
  generatorScope,
  scopePatchIndex
} from '../../generatorScope'
import { colourParam, floatInput, floatParam, type NodeTypeDef } from '../../types'

const ramp = new OklabRamp()

export const ColourFromValue: NodeTypeDef = {
  type: 'colour/from-value',
  label: 'Colour From Value',
  category: 'colour',
  description: 'Maps a float 0..1 to a solid colour ramp across the patch',
  inputs: [
    { name: 'value', label: 'Value', type: 'float' },
    { name: 'pixels', label: 'Pixels', type: 'pixels' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'from', label: 'From', type: 'colour', default: { r: 0, g: 0, b: 0 } },
    { name: 'to', label: 'To', type: 'colour', default: { r: 255, g: 80, b: 0 } },
    { name: 'value', label: 'Value', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 }
  ],
  gpu: { pass: 'colour/from-value' },
  evaluate(inputs, params, ctx) {
    const from = colourParam(params, 'from')
    const to = colourParam(params, 'to')
    const v = Math.max(0, Math.min(1, floatInput(inputs, params, 'value', floatParam(params, 'value', 0.5))))

    ramp.set(from.r / 255, from.g / 255, from.b / 255, to.r / 255, to.g / 255, to.b / 255)

    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    for (let i = 0; i < scope.count; i++) {
      ramp.sample(v, out, scopePatchIndex(scope, i) * 3)
    }
    return { pixels: out }
  }
}
