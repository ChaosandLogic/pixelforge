import { pixelScopeFromSrc, readScopedRgb } from '../../pixelScope'
import { pixelsInput, stringParam, type NodeTypeDef } from '../../types'

export const Luminance: NodeTypeDef = {
  type: 'colour/luminance',
  label: 'Luminance',
  category: 'colour',
  description: 'Extracts brightness from a pixel stream as a float',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [{ name: 'value', label: 'Value', type: 'float' }],
  params: [
    {
      name: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'average',
      options: ['average', 'max', 'min']
    }
  ],
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    const mode = stringParam(params, 'mode', 'average')
    if (src === null || src.length < 3) return { value: 0 }

    const scope = pixelScopeFromSrc(src, ctx)
    if (scope.count <= 0) return { value: 0 }

    let sum = 0
    let max = 0
    let min = 1
    for (let i = 0; i < scope.count; i++) {
      const [r, g, b] = readScopedRgb(src, scope, i)
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      sum += lum
      if (lum > max) max = lum
      if (lum < min) min = lum
    }

    switch (mode) {
      case 'max':
        return { value: max }
      case 'min':
        return { value: min }
      default:
        return { value: sum / scope.count }
    }
  }
}
