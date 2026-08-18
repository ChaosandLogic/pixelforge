import { pixelSortGrid, type PixelSortAxis, type PixelSortMetric } from '../../../spatial/pixelSort'
import {
  beginScopedPixelOutput,
  gridToPixelsScoped,
  pixelScopeFromSrc,
  pixelsToGridScoped,
  scopedResolution
} from '../../pixelScope'
import {
  floatInput,
  floatParam,
  pixelsInput,
  resolutionInput,
  stringParam,
  type NodeTypeDef
} from '../../types'

/**
 * Histogram-style sort of the LED buffer. Stays on the CPU evaluator (v1);
 * wire through an upload/download if a GPU TOP needs it.
 */
export const PixelSort: NodeTypeDef = {
  type: 'transform/pixel-sort',
  label: 'Pixel Sort',
  category: 'transform',
  description: 'Sort pixels by brightness within each row or column (glitch / art)',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' },
    { name: 'threshold', label: 'Threshold', type: 'float' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    {
      name: 'axis',
      label: 'Axis',
      type: 'select',
      default: 'horizontal',
      options: ['horizontal', 'vertical']
    },
    {
      name: 'metric',
      label: 'Metric',
      type: 'select',
      default: 'luminance',
      options: ['luminance', 'red', 'green', 'blue']
    },
    { name: 'threshold', label: 'Threshold', type: 'float', default: 0, min: 0, max: 1, step: 0.01 },
    { name: 'reverse', label: 'Reverse', type: 'boolean', default: false }
  ],
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
    const axis = stringParam(params, 'axis', 'horizontal') as PixelSortAxis
    const metric = stringParam(params, 'metric', 'luminance') as PixelSortMetric
    const threshold = Math.max(
      0,
      Math.min(1, floatInput(inputs, params, 'threshold', floatParam(params, 'threshold', 0)))
    )
    const reverse = params['reverse'] === true

    const out = beginScopedPixelOutput(ctx)
    const grid = pixelsToGridScoped(src, ctx.positions, scope, resolution)
    const sorted = pixelSortGrid(grid, width, height, axis, metric, reverse, threshold)
    gridToPixelsScoped(sorted, out, ctx.positions, scope, resolution)
    return { pixels: out }
  }
}
