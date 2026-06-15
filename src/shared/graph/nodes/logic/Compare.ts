import { floatInput, floatParam, stringParam, type NodeTypeDef } from '../../types'

export const Compare: NodeTypeDef = {
  type: 'logic/compare',
  label: 'Compare',
  category: 'logic',
  description: 'Outputs 1 when comparison is true, else 0',
  inputs: [
    { name: 'a', label: 'A', type: 'float' },
    { name: 'b', label: 'B', type: 'float' }
  ],
  outputs: [{ name: 'value', label: 'Value', type: 'float' }],
  params: [
    {
      name: 'op',
      label: 'Operator',
      type: 'select',
      default: 'gt',
      options: ['gt', 'gte', 'lt', 'lte', 'eq']
    },
    { name: 'b', label: 'B', type: 'float', default: 0.5, min: -10, max: 10, step: 0.01 }
  ],
  evaluate(inputs, params, _ctx) {
    const a = floatInput(inputs, params, 'a', 0)
    const b = floatInput(inputs, params, 'b', floatParam(params, 'b', 0.5))
    const op = stringParam(params, 'op', 'gt')
    let ok = false
    switch (op) {
      case 'gte':
        ok = a >= b
        break
      case 'lt':
        ok = a < b
        break
      case 'lte':
        ok = a <= b
        break
      case 'eq':
        ok = Math.abs(a - b) < 0.001
        break
      default:
        ok = a > b
    }
    return { value: ok ? 1 : 0 }
  }
}
