import { floatInput, floatParam, type NodeTypeDef } from '../../types'

export const Delay: NodeTypeDef = {
  type: 'time/delay',
  label: 'Delay',
  category: 'time',
  description: 'Delays a float signal by a duration in seconds',
  inputs: [{ name: 'value', label: 'Value', type: 'float' }],
  outputs: [{ name: 'value', label: 'Value', type: 'float' }],
  params: [
    { name: 'seconds', label: 'Seconds', type: 'float', default: 0.25, min: 0, max: 10, step: 0.01 }
  ],
  evaluate(inputs, params, ctx) {
    const input = floatInput(inputs, params, 'value', 0)
    const seconds = floatParam(params, 'seconds', 0.25)
    return { value: ctx.delayFloat(input, seconds * 1000) }
  }
}
