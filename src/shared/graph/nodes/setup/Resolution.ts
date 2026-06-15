import { RESOLUTION_NODE_TYPE, type Resolution as ResolutionValue } from '../../../spatial/resolution'
import { intParam, pixelsInput, type NodeTypeDef } from '../../types'

/**
 * Sets logical W×H for downstream pattern nodes. Patch the resolution output
 * into any generator's resolution input to override sampling at that point in
 * the graph. Optional pixels pass-through keeps it in the pixel chain.
 */
export const Resolution: NodeTypeDef = {
  type: RESOLUTION_NODE_TYPE,
  label: 'Resolution',
  category: 'setup',
  description: 'Logical width×height — wire into pattern nodes to set sampling grid',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [
    { name: 'resolution', label: 'Resolution', type: 'resolution' },
    { name: 'pixels', label: 'Pixels', type: 'pixels' }
  ],
  params: [
    { name: 'width', label: 'Width', type: 'int', default: 16, min: 1, max: 512 },
    { name: 'height', label: 'Height', type: 'int', default: 8, min: 1, max: 512 }
  ],
  evaluate(inputs, params, _ctx) {
    const res: ResolutionValue = {
      width: Math.max(1, intParam(params, 'width', 1)),
      height: Math.max(1, intParam(params, 'height', 1))
    }
    const pixels = pixelsInput(inputs, 'pixels')
    const out: Record<string, ResolutionValue | Float32Array> = { resolution: res }
    if (pixels !== null) out.pixels = pixels
    return out
  }
}
