import { pixelsInput, stringParam, type NodeTypeDef } from '../../types'

function pixelLuminance(src: Float32Array, index: number): number {
  const o = index * 3
  return 0.2126 * (src[o] as number) + 0.7152 * (src[o + 1] as number) + 0.0722 * (src[o + 2] as number)
}

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

    const count = Math.min(ctx.pixelCount, Math.floor(src.length / 3))
    if (count <= 0) return { value: 0 }

    let sum = 0
    let max = 0
    let min = 1
    for (let i = 0; i < count; i++) {
      const lum = pixelLuminance(src, i)
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
        return { value: sum / count }
    }
  }
}
