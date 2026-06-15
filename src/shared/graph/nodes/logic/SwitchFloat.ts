import { floatInput, floatParam, type NodeTypeDef } from '../../types'

export const SwitchFloat: NodeTypeDef = {
  type: 'logic/switch-float',
  label: 'Switch Float',
  category: 'logic',
  description: 'Selects between two float values based on a threshold',
  inputs: [
    { name: 'a', label: 'A', type: 'float' },
    { name: 'b', label: 'B', type: 'float' },
    { name: 'select', label: 'Select', type: 'float' }
  ],
  outputs: [{ name: 'value', label: 'Value', type: 'float' }],
  params: [
    { name: 'threshold', label: 'Threshold', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 }
  ],
  evaluate(inputs, params, _ctx) {
    const a = floatInput(inputs, params, 'a', 0)
    const b = floatInput(inputs, params, 'b', 0)
    const sel = floatInput(inputs, params, 'select', 0)
    const threshold = floatParam(params, 'threshold', 0.5)
    return { value: sel >= threshold ? b : a }
  }
}
