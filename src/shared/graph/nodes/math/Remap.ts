import { floatInput, floatParam, type NodeTypeDef } from '../../types'

function remapValue(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
  clamp: boolean
): number {
  const span = inMax - inMin
  const t = span === 0 ? 0 : (value - inMin) / span
  const mapped = outMin + t * (outMax - outMin)
  if (!clamp) return mapped
  const lo = Math.min(outMin, outMax)
  const hi = Math.max(outMin, outMax)
  return mapped < lo ? lo : mapped > hi ? hi : mapped
}

export const Remap: NodeTypeDef = {
  type: 'math/remap',
  label: 'Remap',
  category: 'math',
  description: 'Maps a float from one range to another',
  inputs: [{ name: 'value', label: 'Value', type: 'float' }],
  outputs: [{ name: 'value', label: 'Value', type: 'float' }],
  params: [
    { name: 'inMin', label: 'In min', type: 'float', default: 0, min: -10, max: 10, step: 0.01 },
    { name: 'inMax', label: 'In max', type: 'float', default: 1, min: -10, max: 10, step: 0.01 },
    { name: 'outMin', label: 'Out min', type: 'float', default: 0, min: -10, max: 10, step: 0.01 },
    { name: 'outMax', label: 'Out max', type: 'float', default: 1, min: -10, max: 10, step: 0.01 },
    { name: 'clamp', label: 'Clamp', type: 'boolean', default: true }
  ],
  evaluate(inputs, params, _ctx) {
    const value = floatInput(inputs, params, 'value', 0)
    return {
      value: remapValue(
        value,
        floatParam(params, 'inMin', 0),
        floatParam(params, 'inMax', 1),
        floatParam(params, 'outMin', 0),
        floatParam(params, 'outMax', 1),
        params['clamp'] !== false
      )
    }
  }
}
