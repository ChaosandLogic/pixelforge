import { OklabRamp } from '../../../colour/oklab'
import { parseSpatialAxis, SPATIAL_AXIS_OPTIONS } from '../../spatial'
import {
  beginScopedOutput,
  generatorScope,
  scopeAxisPosition,
  scopePatchIndex
} from '../../generatorScope'
import { colourParam, floatParam, stringParam, type NodeTypeDef } from '../../types'

const ramp = new OklabRamp()

export const Comet: NodeTypeDef = {
  type: 'generator/comet',
  label: 'Comet',
  category: 'generator',
  description: 'Bright head with exponential tail along an axis',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'head', label: 'Head', type: 'colour', default: { r: 255, g: 240, b: 200 } },
    { name: 'tail', label: 'Tail', type: 'colour', default: { r: 0, g: 40, b: 120 } },
    { name: 'axis', label: 'Axis', type: 'select', default: 'index', options: [...SPATIAL_AXIS_OPTIONS] },
    { name: 'length', label: 'Length', type: 'float', default: 0.25, min: 0.02, max: 1, step: 0.01 },
    { name: 'speed', label: 'Speed', type: 'float', default: 0.3, min: -3, max: 3, step: 0.05 },
    { name: 'decay', label: 'Decay', type: 'float', default: 4, min: 0.5, max: 20, step: 0.1 }
  ],
  evaluate(inputs, params, ctx) {
    const head = colourParam(params, 'head')
    const tail = colourParam(params, 'tail')
    const axis = parseSpatialAxis(stringParam(params, 'axis', 'index'))
    const length = floatParam(params, 'length', 0.25)
    const speed = floatParam(params, 'speed', 0.3)
    const decay = floatParam(params, 'decay', 4)
    const timeSec = ctx.timeMs / 1000

    ramp.set(head.r / 255, head.g / 255, head.b / 255, tail.r / 255, tail.g / 255, tail.b / 255)

    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    const headPos = (timeSec * speed) % 1

    for (let i = 0; i < scope.count; i++) {
      const pos = scopeAxisPosition(ctx.positions, i, scope, axis)
      let dist = headPos - pos
      if (dist < 0) dist += 1
      const t = dist <= length ? Math.exp(-dist * length * decay) : 0
      ramp.sample(t, out, scopePatchIndex(scope, i) * 3)
    }
    return { pixels: out }
  }
}
