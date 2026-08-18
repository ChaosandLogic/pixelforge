import {
  beginScopedPixelOutput,
  pixelScopeFromSrc,
  scopeDstOffset,
  scopeSrcOffset
} from '../../pixelScope'
import { floatParam, pixelsInput, type NodeTypeDef } from '../../types'

/** In-place rgb -> hsv -> shift -> rgb on one pixel; writes into out[o..o+2]. */
function shiftPixel(
  r: number,
  g: number,
  b: number,
  hueShift: number,
  satScale: number,
  valScale: number,
  out: Float32Array,
  o: number
): void {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
    if (h < 0) h += 1
  }
  let s = max === 0 ? 0 : d / max
  let v = max

  h = (h + hueShift) % 1
  if (h < 0) h += 1
  s = Math.max(0, Math.min(1, s * satScale))
  v = Math.max(0, Math.min(1, v * valScale))

  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0:
      out[o] = v; out[o + 1] = t; out[o + 2] = p
      break
    case 1:
      out[o] = q; out[o + 1] = v; out[o + 2] = p
      break
    case 2:
      out[o] = p; out[o + 1] = v; out[o + 2] = t
      break
    case 3:
      out[o] = p; out[o + 1] = q; out[o + 2] = v
      break
    case 4:
      out[o] = t; out[o + 1] = p; out[o + 2] = v
      break
    default:
      out[o] = v; out[o + 1] = p; out[o + 2] = q
  }
}

export const HsvShift: NodeTypeDef = {
  type: 'colour/hsv-shift',
  label: 'HSV Shift',
  category: 'colour',
  description: 'Rotates hue, scales saturation and value',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'hue', label: 'Hue', type: 'float', default: 0, min: -1, max: 1, step: 0.01 },
    { name: 'hueSpeed', label: 'Hue Speed', type: 'float', default: 0, min: -2, max: 2, step: 0.01 },
    { name: 'saturation', label: 'Saturation', type: 'float', default: 1, min: 0, max: 2, step: 0.01 },
    { name: 'value', label: 'Value', type: 'float', default: 1, min: 0, max: 2, step: 0.01 }
  ],
  gpu: { pass: 'colour/hsv-shift' },
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    if (src === null) {
      const out = ctx.acquire()
      out.fill(0)
      return { pixels: out }
    }

    const hue = floatParam(params, 'hue') + (ctx.timeMs / 1000) * floatParam(params, 'hueSpeed')
    const sat = floatParam(params, 'saturation', 1)
    const val = floatParam(params, 'value', 1)

    // shiftPixel writes directly at the output offset; no per-pixel allocation.
    const scope = pixelScopeFromSrc(src, ctx)
    const out = beginScopedPixelOutput(ctx)
    for (let i = 0; i < scope.count; i++) {
      const si = scopeSrcOffset(scope, i)
      shiftPixel(
        src[si] as number,
        src[si + 1] as number,
        src[si + 2] as number,
        hue,
        sat,
        val,
        out,
        scopeDstOffset(scope, i)
      )
    }
    return { pixels: out }
  }
}
