import { displaceGrid } from '../../../spatial/displace'
import {
  beginScopedPixelOutput,
  copyScopedPixels,
  gridToPixelsScoped,
  pixelScopeFromSrc,
  pixelsToGridScoped,
  scopedResolution
} from '../../pixelScope'
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
  gpu: { pass: 'transform/displace' },
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    if (src === null) {
      const out = ctx.acquire()
      out.fill(0)
      return { pixels: out }
    }

    const map = pixelsInput(inputs, 'map') ?? src
    const scope = pixelScopeFromSrc(src, ctx)
    const resolution = scopedResolution(scope, resolutionInput(inputs, ctx))
    const width = Math.max(1, Math.floor(resolution.width))
    const height = Math.max(1, Math.floor(resolution.height))
    const amount = Math.max(0, Math.min(32, floatInput(inputs, params, 'amount', floatParam(params, 'amount', 4))))
    const mode = stringParam(params, 'mode', 'luminance-x') as 'luminance-x' | 'luminance-y' | 'map'
    const wrap = stringParam(params, 'edges', 'clamp') === 'wrap'

    if (amount === 0) {
      return { pixels: copyScopedPixels(src, ctx) }
    }

    const out = beginScopedPixelOutput(ctx)
    const srcGrid = pixelsToGridScoped(src, ctx.positions, scope, resolution)
    const mapGrid = pixelsToGridScoped(map, ctx.positions, scope, resolution)
    const displaced = displaceGrid(srcGrid, mapGrid, width, height, amount, mode, wrap)
    gridToPixelsScoped(displaced, out, ctx.positions, scope, resolution)
    return { pixels: out }
  }
}
