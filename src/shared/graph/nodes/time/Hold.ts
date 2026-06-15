import { floatInput, floatParam, type NodeTypeDef } from '../../types'

export const Hold: NodeTypeDef = {
  type: 'time/hold',
  label: 'Hold',
  category: 'time',
  description: 'Holds a float value for a duration after trigger',
  inputs: [
    { name: 'value', label: 'Value', type: 'float' },
    { name: 'trigger', label: 'Trigger', type: 'float' }
  ],
  outputs: [{ name: 'value', label: 'Value', type: 'float' }],
  params: [
    { name: 'seconds', label: 'Seconds', type: 'float', default: 0.5, min: 0.01, max: 30, step: 0.01 }
  ],
  evaluate(inputs, params, ctx) {
    const input = floatInput(inputs, params, 'value', 0)
    const seconds = floatParam(params, 'seconds', 0.5)
    ctx.risingEdge('trigger', floatInput(inputs, params, 'trigger', 0))
    return { value: ctx.holdFloat(input, seconds * 1000, 'trigger') }
  }
}
