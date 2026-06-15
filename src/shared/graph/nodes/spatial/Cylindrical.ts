import { OklabRamp } from '../../../colour/oklab'
import {
  beginScopedOutput,
  generatorScope,
  scopePatchIndex,
  scopeUv
} from '../../generatorScope'
import { colourParam, floatParam, type NodeTypeDef } from '../../types'

const ramp = new OklabRamp()

/** Cylindrical projection: angle around Z maps to palette. */
export const Cylindrical: NodeTypeDef = {
  type: 'spatial/cylindrical',
  label: 'Cylindrical',
  category: 'spatial',
  description: 'Maps cylindrical angle around the install centre to colour',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'from', label: 'From', type: 'colour', default: { r: 255, g: 0, b: 80 } },
    { name: 'to', label: 'To', type: 'colour', default: { r: 0, g: 120, b: 255 } },
    { name: 'phase', label: 'Phase', type: 'float', default: 0, min: 0, max: 1, step: 0.01 },
    { name: 'speed', label: 'Speed', type: 'float', default: 0, min: -2, max: 2, step: 0.01 },
    { name: 'centreX', label: 'Centre X', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
    { name: 'centreY', label: 'Centre Y', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 }
  ],
  evaluate(inputs, params, ctx) {
    const from = colourParam(params, 'from')
    const to = colourParam(params, 'to')
    const phase = floatParam(params, 'phase') + (ctx.timeMs / 1000) * floatParam(params, 'speed')
    const cx = floatParam(params, 'centreX', 0.5)
    const cy = floatParam(params, 'centreY', 0.5)

    ramp.set(from.r / 255, from.g / 255, from.b / 255, to.r / 255, to.g / 255, to.b / 255)

    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    for (let i = 0; i < scope.count; i++) {
      const { u, v } = scopeUv(ctx.positions, i, scope)
      const x = u - cx
      const y = v - cy
      let angle = Math.atan2(y, x) / (Math.PI * 2) + 0.5 + phase
      angle -= Math.floor(angle)
      ramp.sample(angle, out, scopePatchIndex(scope, i) * 3)
    }
    return { pixels: out }
  }
}
