import {
  beginScopedPixelOutput,
  pixelScopeFromSrc,
  readScopedRgb,
  scopedNormalizedU,
  writeScopedRgb
} from '../../pixelScope'
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
  gpu: { pass: 'transform/mask' },
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    if (src === null) {
      const out = ctx.acquire()
      out.fill(0)
      return { pixels: out }
    }

    const scope = pixelScopeFromSrc(src, ctx)
    const out = beginScopedPixelOutput(ctx)
    const start = floatParam(params, 'start', 0.25)
    const end = floatParam(params, 'end', 0.75)
    const soft = floatParam(params, 'softness', 0.1)
    const offset = floatInput(inputs, params, 'offset')
    const invert = params['invert'] === true

    for (let i = 0; i < scope.count; i++) {
      const u = scopedNormalizedU(scope, i) - offset
      let m = smoothstep(start - soft, start, u) * (1 - smoothstep(end, end + soft, u))
      if (invert) m = 1 - m
      const [r, g, b] = readScopedRgb(src, scope, i)
      writeScopedRgb(out, scope, i, r * m, g * m, b * m)
    }
    return { pixels: out }
  }
}
