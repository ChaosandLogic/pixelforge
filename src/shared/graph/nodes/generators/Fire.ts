import { sampleFire } from '../../../spatial/fire'
import {
  beginScopedOutput,
  generatorScope,
  scopePatchIndex,
  scopeUv
} from '../../generatorScope'
import { floatParam, type NodeTypeDef } from '../../types'

export const Fire: NodeTypeDef = {
  type: 'generator/fire',
  label: 'Fire',
  category: 'generator',
  description: 'Procedural fire / fluid-like organic flames',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'scale', label: 'Scale', type: 'float', default: 4, min: 0.5, max: 24, step: 0.5 },
    { name: 'speed', label: 'Speed', type: 'float', default: 1.2, min: 0, max: 6, step: 0.05 },
    { name: 'turbulence', label: 'Turbulence', type: 'float', default: 0.6, min: 0, max: 1, step: 0.01 },
    { name: 'rise', label: 'Rise bias', type: 'float', default: 0.55, min: 0, max: 1, step: 0.01 }
  ],
  evaluate(inputs, params, ctx) {
    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    const timeSec = ctx.timeMs / 1000
    const scale = floatParam(params, 'scale', 4)
    const speed = floatParam(params, 'speed', 1.2)
    const turbulence = floatParam(params, 'turbulence', 0.6)
    const rise = floatParam(params, 'rise', 0.55)

    for (let i = 0; i < scope.count; i++) {
      const { u, v } = scopeUv(ctx.positions, i, scope)
      const [r, g, b] = sampleFire({ u, v, timeSec, scale, speed, turbulence, rise })
      const pi = scopePatchIndex(scope, i) * 3
      out[pi] = r
      out[pi + 1] = g
      out[pi + 2] = b
    }
    return { pixels: out }
  }
}
