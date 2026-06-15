import { displaceGrid, gridToPixels, pixelsToGrid } from '../../../spatial/displace'
import { floatInput, floatParam, pixelsInput, resolutionInput, stringParam, type NodeTypeDef } from '../../types'

export const DISPLACE_NODE_TYPE = 'transform/displace'

/**
 * UV displacement in logical resolution space. Map luminance or RG channels
 * offset the source sample position (TouchDesigner-style warp).
 */
export const Displace: NodeTypeDef = {
  type: DISPLACE_NODE_TYPE,
  label: 'Displace',
  category: 'transform',
  description: 'Warps pixels by a map (luminance or RG offsets UV)',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'map', label: 'Map', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' },
    { name: 'amount', label: 'Amount', type: 'float' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'amount', label: 'Amount', type: 'float', default: 4, min: 0, max: 32, step: 0.5 },
    {
      name: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'luminance-x',
      options: ['luminance-x', 'luminance-y', 'map']
    },
    { name: 'edges', label: 'Edges', type: 'select', default: 'clamp', options: ['clamp', 'wrap'] }
  ],
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }

    const map = pixelsInput(inputs, 'map') ?? src
    const resolution = resolutionInput(inputs, ctx)
    const width = Math.max(1, Math.floor(resolution.width))
    const height = Math.max(1, Math.floor(resolution.height))
    const amount = Math.max(0, Math.min(32, floatInput(inputs, params, 'amount', floatParam(params, 'amount', 4))))
    const mode = stringParam(params, 'mode', 'luminance-x') as 'luminance-x' | 'luminance-y' | 'map'
    const wrap = stringParam(params, 'edges', 'clamp') === 'wrap'

    if (amount === 0) {
      out.set(src)
      return { pixels: out }
    }

    const srcGrid = pixelsToGrid(src, ctx.positions, ctx.pixelCount, resolution)
    const mapGrid = pixelsToGrid(map, ctx.positions, ctx.pixelCount, resolution)
    const displaced = displaceGrid(srcGrid, mapGrid, width, height, amount, mode, wrap)
    gridToPixels(displaced, out, ctx.positions, ctx.pixelCount, resolution)
    return { pixels: out }
  }
}
