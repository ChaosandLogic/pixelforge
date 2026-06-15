import { floatInput, floatParam, pixelsInput, type NodeTypeDef } from '../../types'

export const Switch: NodeTypeDef = {
  type: 'logic/switch',
  label: 'Switch',
  category: 'logic',
  description: 'Selects between two pixel streams based on a float threshold',
  inputs: [
    { name: 'a', label: 'A', type: 'pixels' },
    { name: 'b', label: 'B', type: 'pixels' },
    { name: 'select', label: 'Select', type: 'float' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'threshold', label: 'Threshold', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 }
  ],
  evaluate(inputs, params, ctx) {
    const a = pixelsInput(inputs, 'a')
    const b = pixelsInput(inputs, 'b')
    const out = ctx.acquire()
    const sel = floatInput(inputs, params, 'select', 0)
    const threshold = floatParam(params, 'threshold', 0.5)
    const useB = sel >= threshold

    if (useB) {
      if (b === null) out.fill(0)
      else out.set(b)
    } else {
      if (a === null) out.fill(0)
      else out.set(a)
    }
    return { pixels: out }
  }
}
