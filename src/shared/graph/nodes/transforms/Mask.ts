import { floatInput, floatParam, pixelsInput, type NodeTypeDef } from '../../types'

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Soft window mask along the strip. Drive 'offset' with an LFO (saw) for a
 * travelling wipe.
 */
export const Mask: NodeTypeDef = {
  type: 'transform/mask',
  label: 'Mask',
  category: 'transform',
  description: 'Soft positional mask — animatable wipe via offset input',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'offset', label: 'Offset', type: 'float' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'start', label: 'Start', type: 'float', default: 0.25, min: 0, max: 1, step: 0.01 },
    { name: 'end', label: 'End', type: 'float', default: 0.75, min: 0, max: 1, step: 0.01 },
    { name: 'softness', label: 'Softness', type: 'float', default: 0.1, min: 0, max: 0.5, step: 0.01 },
    { name: 'offset', label: 'Offset', type: 'float', default: 0, min: -1, max: 1, step: 0.01 },
    { name: 'invert', label: 'Invert', type: 'boolean', default: false }
  ],
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }

    const start = floatParam(params, 'start', 0.25)
    const end = floatParam(params, 'end', 0.75)
    const soft = floatParam(params, 'softness', 0.1)
    const offset = floatInput(inputs, params, 'offset')
    const invert = params['invert'] === true
    const n = ctx.pixelCount
    const denom = Math.max(1, n - 1)

    for (let i = 0; i < n; i++) {
      const u = i / denom - offset
      let m = smoothstep(start - soft, start, u) * (1 - smoothstep(end, end + soft, u))
      if (invert) m = 1 - m
      out[i * 3] = (src[i * 3] ?? 0) * m
      out[i * 3 + 1] = (src[i * 3 + 1] ?? 0) * m
      out[i * 3 + 2] = (src[i * 3 + 2] ?? 0) * m
    }
    return { pixels: out }
  }
}
