import { OklabRamp } from '../../../colour/oklab'
import {
  beginScopedOutput,
  generatorScope,
  scopePatchIndex,
  scopeUv
} from '../../generatorScope'
import { colourParam, floatParam, type NodeTypeDef } from '../../types'

const ramp = new OklabRamp()

/** Radial distance from centre as a gradient field. */
export const DistanceField: NodeTypeDef = {
  type: 'spatial/distance-field',
  label: 'Distance Field',
  category: 'spatial',
  description: 'Radial distance from a centre point mapped to colour',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'from', label: 'From', type: 'colour', default: { r: 255, g: 255, b: 255 } },
    { name: 'to', label: 'To', type: 'colour', default: { r: 0, g: 0, b: 0 } },
    { name: 'scale', label: 'Scale', type: 'float', default: 1, min: 0.1, max: 10, step: 0.1 },
    { name: 'centreX', label: 'Centre X', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
    { name: 'centreY', label: 'Centre Y', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
    { name: 'centreZ', label: 'Centre Z', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 }
  ],
  evaluate(inputs, params, ctx) {
    const from = colourParam(params, 'from')
    const to = colourParam(params, 'to')
    const scale = floatParam(params, 'scale', 1)
    const cx = floatParam(params, 'centreX', 0.5)
    const cy = floatParam(params, 'centreY', 0.5)
    const cz = floatParam(params, 'centreZ', 0.5)

    ramp.set(from.r / 255, from.g / 255, from.b / 255, to.r / 255, to.g / 255, to.b / 255)

    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    for (let i = 0; i < scope.count; i++) {
      const global = scopePatchIndex(scope, i)
      const { u, v } = scopeUv(ctx.positions, i, scope)
      const dx = u - cx
      const dy = v - cy
      const dz = (ctx.positions[global * 3 + 2] ?? 0.5) - cz
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) * scale
      ramp.sample(dist > 1 ? 1 : dist, out, global * 3)
    }
    return { pixels: out }
  }
}
