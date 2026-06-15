import { gridToScopedPixels, rasterTextToGrid } from '../../../spatial/textRaster'
import {
  beginScopedOutput,
  generatorScope,
  scopeBounds
} from '../../generatorScope'
import { colourParam, floatInput, floatParam, intParam, stringParam, type NodeTypeDef } from '../../types'

export const Text: NodeTypeDef = {
  type: 'generator/text',
  label: 'Text',
  category: 'generator',
  description: 'Bitmap text / digits for countdowns and signage on matrices',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' },
    { name: 'scale', label: 'Scale', type: 'float' },
    { name: 'scrollX', label: 'Scroll', type: 'float' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'text', label: 'Text', type: 'string', default: '12:34' },
    {
      name: 'align',
      label: 'Align',
      type: 'select',
      default: 'center',
      options: ['left', 'center', 'right']
    },
    { name: 'scale', label: 'Scale', type: 'float', default: 1, min: -8, max: 8, step: 0.05 },
    { name: 'posX', label: 'X', type: 'int', default: 0, min: -64, max: 64 },
    { name: 'posY', label: 'Y', type: 'int', default: 0, min: -64, max: 64 },
    { name: 'colour', label: 'Colour', type: 'colour', default: { r: 255, g: 255, b: 255 } },
    { name: 'strokeSize', label: 'Stroke', type: 'int', default: 0, min: 0, max: 8 },
    { name: 'scrollX', label: 'Scroll', type: 'float', default: 0, min: -512, max: 512, step: 1 },
    { name: 'speed', label: 'Speed', type: 'float', default: 0, min: -20, max: 20, step: 0.05 },
    { name: 'spacing', label: 'Spacing', type: 'int', default: 4, min: 0, max: 64 },
    { name: 'background', label: 'Background', type: 'float', default: 0, min: 0, max: 1, step: 0.01 }
  ],
  evaluate(inputs, params, ctx) {
    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    const { width, height } = scope.resolution
    const w = Math.max(1, width)
    const h = Math.max(1, height)
    const grid = new Float32Array(w * h * 3)

    const c = colourParam(params, 'colour')
    const align = stringParam(params, 'align', 'center') as 'left' | 'center' | 'right'
    const scale = clampTextScale(floatInput(inputs, params, 'scale', floatParam(params, 'scale', 1)))
    const anchorX = Math.floor(w / 2) + intParam(params, 'posX', 0)
    const anchorY =
      Math.floor(h / 2) - Math.floor((7 * Math.abs(scale)) / 2) + intParam(params, 'posY', 0)
    const scrollBase = floatInput(inputs, params, 'scrollX', floatParam(params, 'scrollX', 0))
    const speed = floatParam(params, 'speed', 0)
    const scroll = scrollBase + (ctx.timeMs / 1000) * speed

    rasterTextToGrid(grid, {
      text: stringParam(params, 'text', ''),
      width: w,
      height: h,
      anchorX,
      anchorY,
      scale,
      align,
      r: c.r / 255,
      g: c.g / 255,
      b: c.b / 255,
      strokeSize: intParam(params, 'strokeSize', 0),
      background: floatParam(params, 'background', 0),
      scroll,
      spacing: intParam(params, 'spacing', 4),
      tiled: speed !== 0 || scrollBase !== 0
    })

    gridToScopedPixels(grid, out, ctx.positions, scope, scope.fullPatch ? undefined : scopeBounds(ctx.positions, scope))
    return { pixels: out }
  }
}

/** Avoid zero scale; clamp to ±8. */
function clampTextScale(value: number): number {
  let s = Math.max(-8, Math.min(8, value))
  if (Math.abs(s) < 0.05) s = s < 0 ? -0.05 : 0.05
  return s
}
