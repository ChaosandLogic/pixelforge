import { floatInput, floatParam, pixelsInput, stringParam, type NodeTypeDef } from '../../types'

export const FEEDBACK_NODE_TYPE = 'composite/feedback'

/**
 * Temporal compositor: blends the input with this node's previous output.
 * State persists across frames — wire a generator through Feedback for trails,
 * smear, and persistence without creating graph cycles.
 */
export const Feedback: NodeTypeDef = {
  type: FEEDBACK_NODE_TYPE,
  label: 'Feedback',
  category: 'composite',
  description: 'Mixes input with the previous frame for trails and persistence',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'amount', label: 'Amount', type: 'float' },
    { name: 'reset', label: 'Reset', type: 'trigger' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    {
      name: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'add',
      options: ['mix', 'add', 'screen', 'multiply']
    },
    { name: 'amount', label: 'Amount', type: 'float', default: 0.85, min: 0, max: 1, step: 0.01 },
    { name: 'decay', label: 'Decay', type: 'float', default: 0.95, min: 0, max: 1, step: 0.01 }
  ],
  gpu: { pass: 'composite/feedback' },
  evaluate(inputs, params, ctx) {
    const input = pixelsInput(inputs, 'pixels')

    if (input === null) {
      const out = ctx.acquire()
      out.fill(0)
      return { pixels: out }
    }

    const mode = stringParam(params, 'mode', 'add')
    const amount = Math.max(0, Math.min(1, floatInput(inputs, params, 'amount', 0.85)))
    const decay = Math.max(0, Math.min(1, floatParam(params, 'decay', 0.95)))
    const reset = ctx.consumeTrigger(ctx.nodeId, 'reset')

    return {
      pixels: ctx.feedbackPixels(input, amount, decay, mode, reset)
    }
  }
}
