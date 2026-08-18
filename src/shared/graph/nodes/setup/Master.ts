import { floatInput, floatParam, pixelsInput, type NodeTypeDef } from '../../types'

export const Master: NodeTypeDef = {
  type: 'setup/master',
  label: 'Master',
  category: 'setup',
  description: 'Global intensity / blackout on a pixel stream',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'level', label: 'Level', type: 'float' },
    { name: 'mute', label: 'Mute', type: 'trigger' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'level', label: 'Level', type: 'float', default: 1, min: 0, max: 1, step: 0.01 }
  ],
  gpu: { pass: 'setup/master' },
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }

    let level = Math.max(0, Math.min(1, floatInput(inputs, params, 'level', floatParam(params, 'level', 1))))
    if (ctx.consumeTrigger(ctx.nodeId, 'mute')) level = 0

    for (let i = 0; i < src.length; i++) {
      out[i] = (src[i] as number) * level
    }
    return { pixels: out }
  }
}
