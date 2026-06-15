import { floatParam, type NodeTypeDef } from '../../types'

export const Constant: NodeTypeDef = {
  type: 'math/constant',
  label: 'Constant',
  category: 'math',
  description: 'Outputs a fixed float value',
  inputs: [],
  outputs: [{ name: 'value', label: 'Value', type: 'float' }],
  params: [{ name: 'value', label: 'Value', type: 'float', default: 0.5, min: -10, max: 10, step: 0.01 }],
  evaluate(_inputs, params, _ctx) {
    return { value: floatParam(params, 'value', 0) }
  }
}
