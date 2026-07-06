import { OklabGradientRamp } from '../../../colour/oklab'
import {
  defaultGradientStops,
  mapGradientPosition,
  parseGradientStops
} from '../../../colour/gradientStops'
import {
  axisPosition,
  GRADIENT_AXIS_OPTIONS,
  parseGradientAxis,
  radialDistance
} from '../../spatial'
import {
  beginScopedOutput,
  generatorScope,
  scopeAxisPosition,
  scopePatchIndex,
  scopeUv
} from '../../generatorScope'
import { floatInput, floatParam, stringParam, type NodeTypeDef } from '../../types'

export const GRADIENT_NODE_TYPE = 'generator/gradient'

const ramp = new OklabGradientRamp()

export const Gradient: NodeTypeDef = {
  type: GRADIENT_NODE_TYPE,
  label: 'Gradient',
  category: 'generator',
  description: 'Multi-stop colour ramp across a spatial axis or circular field (Oklab)',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' },
    { name: 'phase', label: 'Phase', type: 'float' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'stops', label: 'Ramp', type: 'gradient-stops', default: defaultGradientStops() },
    {
      name: 'axis',
      label: 'Axis',
      type: 'select',
      default: 'x',
      options: [...GRADIENT_AXIS_OPTIONS]
    },
    { name: 'centreX', label: 'Centre X', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
    { name: 'centreY', label: 'Centre Y', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
    { name: 'centreZ', label: 'Centre Z', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
    { name: 'offset', label: 'Offset', type: 'float', default: 0, min: -1, max: 1, step: 0.01 },
    { name: 'scale', label: 'Scale', type: 'float', default: 1, min: 0.1, max: 10, step: 0.1 },
    { name: 'phase', label: 'Phase', type: 'float', default: 0, min: -2, max: 2, step: 0.01 },
    { name: 'speed', label: 'Phase speed', type: 'float', default: 0, min: -5, max: 5, step: 0.05 },
    { name: 'mirror', label: 'Mirror', type: 'boolean', default: false }
  ],
  evaluate(inputs, params, ctx) {
    const stops = parseGradientStops(params['stops'], params)
    ramp.setStops(
      stops.map((s) => ({
        position: s.position,
        r: s.colour.r / 255,
        g: s.colour.g / 255,
        b: s.colour.b / 255
      }))
    )

    const axis = parseGradientAxis(stringParam(params, 'axis', 'x'))
    const centreX = floatParam(params, 'centreX', 0.5)
    const centreY = floatParam(params, 'centreY', 0.5)
    const centreZ = floatParam(params, 'centreZ', 0.5)
    const offset = floatParam(params, 'offset')
    const scale = floatParam(params, 'scale', 1)
    const mirror = params['mirror'] === true
    const phase =
      floatInput(inputs, params, 'phase', floatParam(params, 'phase', 0)) +
      (ctx.timeMs / 1000) * floatParam(params, 'speed', 0)

    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    for (let i = 0; i < scope.count; i++) {
      let pos: number
      if (axis === 'circular') {
        const global = scopePatchIndex(scope, i)
        const { u, v } = scopeUv(ctx.positions, i, scope)
        const z = ctx.positions[global * 3 + 2] ?? 0.5
        pos = radialDistance(u, v, z, centreX, centreY, centreZ)
      } else {
        pos = scope.fullPatch
          ? axisPosition(ctx.positions, i, scope.resolution, axis, scope.count)
          : scopeAxisPosition(ctx.positions, i, scope, axis)
      }
      const t = mapGradientPosition(pos, offset, scale, phase, mirror)
      ramp.sample(t, out, scopePatchIndex(scope, i) * 3)
    }
    return { pixels: out }
  }
}
