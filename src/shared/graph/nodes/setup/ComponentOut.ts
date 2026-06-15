import { pixelsInput, type NodeTypeDef } from '../../types'

export const ComponentOut: NodeTypeDef = {
  type: 'setup/component-out',
  label: 'Component Out',
  category: 'setup',
  description: 'Terminal output of an embedded subgraph',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [],
  evaluate(inputs, _params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }
    out.set(src)
    return { pixels: out }
  }
}
