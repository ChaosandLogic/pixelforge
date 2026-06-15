import { floatInput, floatParam, type NodeTypeDef } from '../../types'

export const Smooth: NodeTypeDef = {
  type: 'math/smooth',
  label: 'Smooth',
  category: 'math',
  description: 'Low-pass filter on a float signal',
  inputs: [{ name: 'value', label: 'Value', type: 'float' }],
  outputs: [{ name: 'value', label: 'Value', type: 'float' }],
  params: [
    { name: 'smooth', label: 'Smooth (ms)', type: 'float', default: 200, min: 1, max: 5000, step: 1 }
  ],
  evaluate(inputs, params, ctx) {
    const input = floatInput(inputs, params, 'value', 0)
    const smoothMs = floatParam(params, 'smooth', 200)
    return { value: ctx.smoothFloat(input, smoothMs) }
  }
}
