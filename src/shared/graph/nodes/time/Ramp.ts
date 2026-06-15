import { floatInput, floatParam, type NodeTypeDef } from '../../types'

export const Ramp: NodeTypeDef = {
  type: 'time/ramp',
  label: 'Ramp',
  category: 'time',
  description: 'Outputs 0→1 ramp over a duration (loop or trigger restart)',
  inputs: [{ name: 'trigger', label: 'Trigger', type: 'float' }],
  outputs: [{ name: 'value', label: 'Value', type: 'float' }],
  params: [
    { name: 'seconds', label: 'Seconds', type: 'float', default: 2, min: 0.1, max: 60, step: 0.1 },
    { name: 'loop', label: 'Loop', type: 'boolean', default: true }
  ],
  evaluate(inputs, params, ctx) {
    const seconds = floatParam(params, 'seconds', 2)
    const loop = params['loop'] !== false
    ctx.risingEdge('trigger', floatInput(inputs, params, 'trigger', 0))
    return { value: ctx.rampFloat(seconds * 1000, loop, 'trigger') }
  }
}
