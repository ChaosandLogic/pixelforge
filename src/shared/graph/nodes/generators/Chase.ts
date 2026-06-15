import { OklabRamp } from '../../../colour/oklab'
import { parseSpatialAxis, SPATIAL_AXIS_OPTIONS } from '../../spatial'
import {
  beginScopedOutput,
  generatorScope,
  scopeAxisPosition,
  scopePatchIndex
} from '../../generatorScope'
import { colourParam, floatParam, intParam, stringParam, type NodeTypeDef } from '../../types'

const ramp = new OklabRamp()

export const Chase: NodeTypeDef = {
  type: 'generator/chase',
  label: 'Chase',
  category: 'generator',
  description: 'Moving lit pixels with tail falloff along an axis',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'colour', label: 'Colour', type: 'colour', default: { r: 255, g: 255, b: 255 } },
    { name: 'offColour', label: 'Off', type: 'colour', default: { r: 0, g: 0, b: 0 } },
    { name: 'axis', label: 'Axis', type: 'select', default: 'index', options: [...SPATIAL_AXIS_OPTIONS] },
    { name: 'size', label: 'Size', type: 'int', default: 3, min: 1, max: 64 },
    { name: 'spacing', label: 'Spacing', type: 'int', default: 8, min: 1, max: 256 },
    { name: 'speed', label: 'Speed', type: 'float', default: 0.5, min: -5, max: 5, step: 0.05 },
    { name: 'falloff', label: 'Falloff', type: 'float', default: 0.6, min: 0.05, max: 1, step: 0.05 }
  ],
  evaluate(inputs, params, ctx) {
    const on = colourParam(params, 'colour')
    const off = colourParam(params, 'offColour')
    const axis = parseSpatialAxis(stringParam(params, 'axis', 'index'))
    const size = intParam(params, 'size', 3)
    const spacing = intParam(params, 'spacing', 8)
    const speed = floatParam(params, 'speed', 0.5)
    const falloff = floatParam(params, 'falloff', 0.6)
    const timeSec = ctx.timeMs / 1000

    ramp.set(on.r / 255, on.g / 255, on.b / 255, off.r / 255, off.g / 255, off.b / 255)

    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    const headTravel = (timeSec * speed) % 1

    for (let i = 0; i < scope.count; i++) {
      const pos = scopeAxisPosition(ctx.positions, i, scope, axis)
      const phase = (pos - headTravel + 1) % 1
      const distCells = phase * spacing
      const inHead = distCells < size
      const t = inHead ? 1 - distCells / Math.max(1, size) * (1 - falloff) : 0
      ramp.sample(t, out, scopePatchIndex(scope, i) * 3)
    }
    return { pixels: out }
  }
}
