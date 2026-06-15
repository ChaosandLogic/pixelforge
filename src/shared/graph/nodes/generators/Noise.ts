import { OklabRamp } from '../../../colour/oklab'
import { perlin3D, perlin4D, valueNoise3D } from '../../../spatial/noise'
import { valueNoise2D } from '../../../spatial/resolution'
import {
  beginScopedOutput,
  generatorScope,
  scopePatchIndex,
  scopeUv
} from '../../generatorScope'
import { colourParam, floatParam, stringParam, type NodeTypeDef } from '../../types'

const ramp = new OklabRamp()

export const NOISE_TYPE_OPTIONS = [
  'value2d',
  'value3d',
  'perlin3d',
  'perlin4d-time',
  'perlin4d-space'
] as const

export type NoiseType = (typeof NOISE_TYPE_OPTIONS)[number]

function sampleNoise(
  type: NoiseType,
  positions: Float32Array,
  localIndex: number,
  scope: ReturnType<typeof generatorScope>,
  scale: number,
  timeSec: number,
  speed: number,
  wScale: number
): number {
  const { u, v, cellX, cellY } = scopeUv(positions, localIndex, scope)
  const global = scopePatchIndex(scope, localIndex)
  const z = positions[global * 3 + 2] ?? 0
  const s = scale * 0.15

  switch (type) {
    case 'value3d':
      return valueNoise3D(cellX * s, cellY * s, z * s)
    case 'perlin3d':
      return perlin3D(u * scale, v * scale, z * scale)
    case 'perlin4d-time':
      return perlin4D(u * scale, v * scale, z * scale, timeSec * speed)
    case 'perlin4d-space':
      return perlin4D(u * scale, v * scale, z * scale, wScale + z * scale * 0.5)
    case 'value2d':
    default:
      return valueNoise2D(cellX * s, cellY * s + timeSec * speed)
  }
}

export const Noise: NodeTypeDef = {
  type: 'generator/noise',
  label: 'Noise',
  category: 'generator',
  description: 'Procedural noise between two colours (Oklab)',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    {
      name: 'noiseType',
      label: 'Type',
      type: 'select',
      default: 'value2d',
      options: [...NOISE_TYPE_OPTIONS]
    },
    { name: 'colourA', label: 'Colour A', type: 'colour', default: { r: 10, g: 0, b: 40 } },
    { name: 'colourB', label: 'Colour B', type: 'colour', default: { r: 255, g: 40, b: 120 } },
    { name: 'scale', label: 'Scale', type: 'float', default: 5, min: 0.5, max: 50, step: 0.5 },
    { name: 'speed', label: 'Speed', type: 'float', default: 1, min: -10, max: 10, step: 0.1 },
    { name: 'wScale', label: 'W Offset', type: 'float', default: 0, min: -20, max: 20, step: 0.1 },
    { name: 'contrast', label: 'Contrast', type: 'float', default: 1, min: 0.2, max: 4, step: 0.05 }
  ],
  evaluate(inputs, params, ctx) {
    const a = colourParam(params, 'colourA')
    const b = colourParam(params, 'colourB')
    const noiseType = stringParam(params, 'noiseType', 'value2d') as NoiseType
    const scale = floatParam(params, 'scale', 5)
    const speed = floatParam(params, 'speed', 1)
    const wScale = floatParam(params, 'wScale', 0)
    const contrast = floatParam(params, 'contrast', 1)
    const timeSec = ctx.timeMs / 1000

    ramp.set(a.r / 255, a.g / 255, a.b / 255, b.r / 255, b.g / 255, b.b / 255)

    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    for (let i = 0; i < scope.count; i++) {
      let n = sampleNoise(noiseType, ctx.positions, i, scope, scale, timeSec, speed, wScale)
      n = (n - 0.5) * contrast + 0.5
      ramp.sample(n, out, scopePatchIndex(scope, i) * 3)
    }
    return { pixels: out }
  }
}
