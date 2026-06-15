import { OklabRamp } from '../../../colour/oklab'
import {
  beginScopedOutput,
  generatorScope,
  scopePatchIndex
} from '../../generatorScope'
import { colourParam, floatParam, type NodeTypeDef } from '../../types'

const ramp = new OklabRamp()

function hash2(i: number, t: number): number {
  const s = Math.sin(i * 127.1 + t * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export const Twinkle: NodeTypeDef = {
  type: 'generator/twinkle',
  label: 'Twinkle',
  category: 'generator',
  description: 'Random per-pixel sparkle flicker',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'colour', label: 'Colour', type: 'colour', default: { r: 255, g: 255, b: 255 } },
    { name: 'offColour', label: 'Off', type: 'colour', default: { r: 0, g: 0, b: 0 } },
    { name: 'density', label: 'Density', type: 'float', default: 0.15, min: 0.01, max: 1, step: 0.01 },
    { name: 'speed', label: 'Speed', type: 'float', default: 2, min: 0.1, max: 20, step: 0.1 },
    { name: 'minBright', label: 'Min', type: 'float', default: 0.2, min: 0, max: 1, step: 0.01 },
    { name: 'maxBright', label: 'Max', type: 'float', default: 1, min: 0, max: 1, step: 0.01 }
  ],
  evaluate(inputs, params, ctx) {
    const on = colourParam(params, 'colour')
    const off = colourParam(params, 'offColour')
    const density = floatParam(params, 'density', 0.15)
    const speed = floatParam(params, 'speed', 2)
    const minBright = floatParam(params, 'minBright', 0.2)
    const maxBright = floatParam(params, 'maxBright', 1)
    const timeSec = ctx.timeMs / 1000

    ramp.set(on.r / 255, on.g / 255, on.b / 255, off.r / 255, off.g / 255, off.b / 255)

    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)

    for (let i = 0; i < scope.count; i++) {
      const global = scopePatchIndex(scope, i)
      const gate = hash2(global, Math.floor(timeSec * speed))
      const flicker = hash2(global * 3 + 7, timeSec * speed * 2.3)
      const active = gate < density ? minBright + flicker * (maxBright - minBright) : 0
      ramp.sample(active, out, global * 3)
    }
    return { pixels: out }
  }
}
