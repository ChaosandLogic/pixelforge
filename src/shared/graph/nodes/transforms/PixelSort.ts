import { pixelSortGrid, type PixelSortAxis, type PixelSortMetric } from '../../../spatial/pixelSort'
import { gridToPixels, pixelsToGrid } from '../../../spatial/blur'
import {
  floatInput,
  floatParam,
  pixelsInput,
  resolutionInput,
  stringParam,
  type NodeTypeDef
} from '../../types'

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
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }

    const resolution = resolutionInput(inputs, ctx)
    const width = Math.max(1, Math.floor(resolution.width))
    const height = Math.max(1, Math.floor(resolution.height))
    const axis = stringParam(params, 'axis', 'horizontal') as PixelSortAxis
    const metric = stringParam(params, 'metric', 'luminance') as PixelSortMetric
    const threshold = Math.max(
      0,
      Math.min(1, floatInput(inputs, params, 'threshold', floatParam(params, 'threshold', 0)))
    )
    const reverse = params['reverse'] === true

    const grid = pixelsToGrid(src, ctx.positions, ctx.pixelCount, resolution)
    const sorted = pixelSortGrid(grid, width, height, axis, metric, reverse, threshold)
    gridToPixels(sorted, out, ctx.positions, ctx.pixelCount, resolution)
    return { pixels: out }
  }
}
