import { blurGrid } from '../../../spatial/blur'
import {
  beginScopedPixelOutput,
  copyScopedPixels,
  gridToPixelsScoped,
  pixelScopeFromSrc,
  pixelsToGridScoped,
  scopedResolution
} from '../../pixelScope'
import { floatInput, intParam, pixelsInput, resolutionInput, stringParam, type NodeTypeDef } from '../../types'

export const BLUR_NODE_TYPE = 'transform/blur'

/**
 * Box blur in logical resolution space. Works on matrices and 1×N strips
 * (horizontal-only blur on a single row).
 */
export const Blur: NodeTypeDef = {
  type: BLUR_NODE_TYPE,
  label: 'Blur',
  category: 'transform',
  description: 'Softens the pattern with a box blur in resolution space',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' },
    { name: 'radius', label: 'Radius', type: 'float' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'radius', label: 'Radius', type: 'int', default: 2, min: 0, max: 32 },
    {
      name: 'direction',
      label: 'Direction',
      type: 'select',
      default: 'both',
      options: ['both', 'horizontal', 'vertical']
    },
    { name: 'edges', label: 'Edges', type: 'select', default: 'clamp', options: ['clamp', 'wrap'] }
  ],
  gpu: { pass: 'transform/blur' },
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    if (src === null) {
      const out = ctx.acquire()
      out.fill(0)
      return { pixels: out }
    }

    const scope = pixelScopeFromSrc(src, ctx)
    const resolution = scopedResolution(scope, resolutionInput(inputs, ctx))
    const width = Math.max(1, Math.floor(resolution.width))
    const height = Math.max(1, Math.floor(resolution.height))
    const radius = Math.max(0, Math.min(32, Math.round(floatInput(inputs, params, 'radius', intParam(params, 'radius', 2)))))
    const direction = stringParam(params, 'direction', 'both') as 'both' | 'horizontal' | 'vertical'
    const wrap = stringParam(params, 'edges', 'clamp') === 'wrap'

    if (radius === 0) {
      return { pixels: copyScopedPixels(src, ctx) }
    }

    let dir = direction
    if (height === 1 && dir !== 'horizontal') dir = 'horizontal'
    if (width === 1 && dir !== 'vertical') dir = 'vertical'

    const out = beginScopedPixelOutput(ctx)
    const grid = pixelsToGridScoped(src, ctx.positions, scope, resolution)
    const blurred = blurGrid(grid, width, height, radius, dir, wrap)
    gridToPixelsScoped(blurred, out, ctx.positions, scope, resolution)
    return { pixels: out }
  }
}
