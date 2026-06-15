import { floatInput, floatParam, stringParam, type NodeTypeDef } from '../../types'

const OPS = ['add', 'sub', 'mul', 'div', 'min', 'max'] as const

export const MathOp: NodeTypeDef = {
  type: 'math/op',
  label: 'Math',
  category: 'math',
  description: 'Combine two floats (add, sub, mul, div, min, max)',
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
      default: 'add',
      options: [...OPS]
    },
    { name: 'b', label: 'B', type: 'float', default: 0, min: -10, max: 10, step: 0.01 }
  ],
  evaluate(inputs, params, _ctx) {
    const a = floatInput(inputs, params, 'a', 0)
    const b = floatInput(inputs, params, 'b', floatParam(params, 'b', 0))
    const op = stringParam(params, 'op', 'add')
    let value = 0
    switch (op) {
      case 'sub':
        value = a - b
        break
      case 'mul':
        value = a * b
        break
      case 'div':
        value = b === 0 ? 0 : a / b
        break
      case 'min':
        value = Math.min(a, b)
        break
      case 'max':
        value = Math.max(a, b)
        break
      default:
        value = a + b
    }
    return { value }
  }
}
