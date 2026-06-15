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
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }

    const dark = colourParam(params, 'dark')
    const light = colourParam(params, 'light')
    ramp.set(dark.r / 255, dark.g / 255, dark.b / 255, light.r / 255, light.g / 255, light.b / 255)

    for (let i = 0; i < ctx.pixelCount; i++) {
      const o = i * 3
      const lum =
        0.2126 * (src[o] as number) + 0.7152 * (src[o + 1] as number) + 0.0722 * (src[o + 2] as number)
      ramp.sample(lum, out, o)
    }
    return { pixels: out }
  }
}
