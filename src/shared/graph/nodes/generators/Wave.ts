import { OklabRamp } from '../../../colour/oklab'
import { axisPosition, parseSpatialAxis, SPATIAL_AXIS_OPTIONS } from '../../spatial'
import {
  beginScopedOutput,
  generatorScope,
  scopeAxisPosition,
  scopePatchIndex
} from '../../generatorScope'
import { colourParam, floatParam, stringParam, type NodeTypeDef } from '../../types'

const ramp = new OklabRamp()
const TWO_PI = Math.PI * 2

export const Wave: NodeTypeDef = {
  type: 'generator/wave',
  label: 'Wave',
  category: 'generator',
  description: 'Travelling sine wave between two colours (Oklab)',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'colourA', label: 'Colour A', type: 'colour', default: { r: 0, g: 0, b: 0 } },
    { name: 'colourB', label: 'Colour B', type: 'colour', default: { r: 0, g: 200, b: 255 } },
    { name: 'axis', label: 'Axis', type: 'select', default: 'x', options: [...SPATIAL_AXIS_OPTIONS] },
    { name: 'frequency', label: 'Frequency', type: 'float', default: 2, min: 0.1, max: 20, step: 0.1 },
    { name: 'speed', label: 'Speed', type: 'float', default: 0.5, min: -5, max: 5, step: 0.05 }
  ],
  gpu: { pass: 'generator/wave' },
  evaluate(inputs, params, ctx) {
    const a = colourParam(params, 'colourA')
    const b = colourParam(params, 'colourB')
    const axis = parseSpatialAxis(stringParam(params, 'axis', 'x'))
    const frequency = floatParam(params, 'frequency', 2)
    const speed = floatParam(params, 'speed', 0.5)
    const timeSec = ctx.timeMs / 1000

    ramp.set(a.r / 255, a.g / 255, a.b / 255, b.r / 255, b.g / 255, b.b / 255)

    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    for (let i = 0; i < scope.count; i++) {
      const pos = scope.fullPatch
        ? axisPosition(ctx.positions, i, scope.resolution, axis, scope.count)
        : scopeAxisPosition(ctx.positions, i, scope, axis)
      const t = 0.5 + 0.5 * Math.sin(TWO_PI * (frequency * pos - speed * timeSec))
      ramp.sample(t, out, scopePatchIndex(scope, i) * 3)
    }
    return { pixels: out }
  }
}
