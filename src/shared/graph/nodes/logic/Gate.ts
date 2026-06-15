import { floatInput, floatParam, type NodeTypeDef } from '../../types'

export const Gate: NodeTypeDef = {
  type: 'logic/gate',
  label: 'Gate',
  category: 'logic',
  description: 'Passes a float value when gate is open',
  inputs: [
    { name: 'value', label: 'Value', type: 'float' },
    { name: 'gate', label: 'Gate', type: 'float' }
  ],
  outputs: [{ name: 'value', label: 'Value', type: 'float' }],
  params: [
    { name: 'threshold', label: 'Threshold', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 }
  ],
  evaluate(inputs, params, _ctx) {
    const value = floatInput(inputs, params, 'value', 0)
    const gate = floatInput(inputs, params, 'gate', 1)
    const threshold = floatParam(params, 'threshold', 0.5)
    return { value: gate >= threshold ? value : 0 }
  }
}
