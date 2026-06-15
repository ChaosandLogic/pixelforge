import { pixelsInput, stringParam, type NodeTypeDef } from '../../types'

export const Merge: NodeTypeDef = {
  type: 'composite/merge',
  label: 'Merge',
  category: 'composite',
  description: 'Combine three pixel streams (add, max, or average)',
  inputs: [
    { name: 'a', label: 'A', type: 'pixels' },
    { name: 'b', label: 'B', type: 'pixels' },
    { name: 'c', label: 'C', type: 'pixels' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    {
      name: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'add',
      options: ['add', 'max', 'average']
    }
  ],
  evaluate(inputs, params, ctx) {
    const a = pixelsInput(inputs, 'a')
    const b = pixelsInput(inputs, 'b')
    const c = pixelsInput(inputs, 'c')
    const out = ctx.acquire()
    const mode = stringParam(params, 'mode', 'add')
    const len = ctx.pixelCount * 3
    out.fill(0)

    const streams = [a, b, c].filter((s): s is Float32Array => s !== null)
    if (streams.length === 0) return { pixels: out }

    for (let i = 0; i < len; i++) {
      let sum = 0
      let max = 0
      let count = 0
      for (const s of streams) {
        if (i >= s.length) continue
        const v = s[i] as number
        sum += v
        if (v > max) max = v
        count++
      }
      if (count === 0) continue
      switch (mode) {
        case 'max':
          out[i] = max
          break
        case 'average':
          out[i] = sum / count
          break
        default:
          out[i] = sum > 1 ? 1 : sum
      }
    }
    return { pixels: out }
  }
}
