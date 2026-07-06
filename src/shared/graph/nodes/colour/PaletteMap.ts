import {
  beginScopedPixelOutput,
  pixelScopeFromSrc,
  scopeDstOffset,
  scopeSrcOffset
} from '../../pixelScope'
import { OklabRamp } from '../../../colour/oklab'
import { colourParam, pixelsInput, type NodeTypeDef } from '../../types'

const ramp = new OklabRamp()

/** Map pixel luminance to a two-colour palette in Oklab. */
export const PaletteMap: NodeTypeDef = {
  type: 'colour/palette-map',
  label: 'Palette Map',
  category: 'colour',
  description: 'Maps luminance to a two-colour palette (Oklab)',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'dark', label: 'Dark', type: 'colour', default: { r: 0, g: 0, b: 0 } },
    { name: 'light', label: 'Light', type: 'colour', default: { r: 255, g: 255, b: 255 } }
  ],
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    if (src === null) {
      const out = ctx.acquire()
      out.fill(0)
      return { pixels: out }
    }

    const dark = colourParam(params, 'dark')
    const light = colourParam(params, 'light')
    ramp.set(dark.r / 255, dark.g / 255, dark.b / 255, light.r / 255, light.g / 255, light.b / 255)

    // Write straight into the pooled output; no per-pixel allocation.
    const scope = pixelScopeFromSrc(src, ctx)
    const out = beginScopedPixelOutput(ctx)
    for (let i = 0; i < scope.count; i++) {
      const si = scopeSrcOffset(scope, i)
      const r = src[si] as number
      const g = src[si + 1] as number
      const b = src[si + 2] as number
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      ramp.sample(lum, out, scopeDstOffset(scope, i))
    }
    return { pixels: out }
  }
}
