import { floatParam, type NodeTypeDef } from '../../types'

export const Random: NodeTypeDef = {
  type: 'math/random',
  label: 'Random',
  category: 'math',
  description: 'Random float; re-roll on trigger or at a rate',
  inputs: [{ name: 'trigger', label: 'Trigger', type: 'trigger' }],
  outputs: [{ name: 'value', label: 'Value', type: 'float' }],
  params: [
    { name: 'min', label: 'Min', type: 'float', default: 0, min: -10, max: 10, step: 0.01 },
    { name: 'max', label: 'Max', type: 'float', default: 1, min: -10, max: 10, step: 0.01 },
    { name: 'rate', label: 'Rate (Hz)', type: 'float', default: 0, min: 0, max: 20, step: 0.1 }
  ],
  evaluate(_inputs, params, ctx) {
    const forced = ctx.consumeTrigger(ctx.nodeId, 'trigger')
    const min = floatParam(params, 'min', 0)
    const max = floatParam(params, 'max', 1)
    const rate = floatParam(params, 'rate', 0)
    return { value: ctx.randomFloat(min, max, rate, forced) }
  }
}
