import { scopeBounds, scopeCellCoord } from '../../generatorScope'
import {
  beginScopedPixelOutput,
  pixelScopeFromSrc,
  readScopedRgb,
  scopedResolution,
  writeScopedRgb
} from '../../pixelScope'
import { spatialCoord } from '../../../spatial/resolution'
import { floatInput, floatParam, pixelsInput, resolutionInput, type NodeTypeDef } from '../../types'

/** Rotate UV around centre in logical resolution space. */
export const Rotate: NodeTypeDef = {
  type: 'transform/rotate',
  label: 'Rotate',
  category: 'transform',
  description: 'Rotates the pattern around a centre point in UV space',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' },
    { name: 'angle', label: 'Angle', type: 'float' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'angle', label: 'Angle (turns)', type: 'float', default: 0, min: -2, max: 2, step: 0.01 },
    { name: 'speed', label: 'Speed', type: 'float', default: 0, min: -2, max: 2, step: 0.01 },
    { name: 'centreU', label: 'Centre U', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
    { name: 'centreV', label: 'Centre V', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 }
  ],
  gpu: { pass: 'transform/rotate' },
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    if (src === null) {
      const out = ctx.acquire()
      out.fill(0)
      return { pixels: out }
    }

    const scope = pixelScopeFromSrc(src, ctx)
    const resolution = scopedResolution(scope, resolutionInput(inputs, ctx))
    const angleTurns =
      floatInput(inputs, params, 'angle') + (ctx.timeMs / 1000) * floatParam(params, 'speed')
    const theta = angleTurns * Math.PI * 2
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    const cu = floatParam(params, 'centreU', 0.5)
    const cv = floatParam(params, 'centreV', 0.5)
    const { width, height } = resolution
    const bounds = scope.fullPatch ? undefined : scopeBounds(ctx.positions, scope)

    const cellMap = new Map<number, number>()
    for (let li = 0; li < scope.count; li++) {
      const patchIdx = scope.indices[li] as number
      const { cellX, cellY } = scope.fullPatch
        ? spatialCoord(ctx.positions, patchIdx, resolution)
        : scopeCellCoord(ctx.positions, patchIdx, scope, bounds)
      const key = cellY * width + cellX
      if (!cellMap.has(key)) cellMap.set(key, li)
    }

    const out = beginScopedPixelOutput(ctx)
    for (let li = 0; li < scope.count; li++) {
      const patchIdx = scope.indices[li] as number
      const { cellX, cellY } = scope.fullPatch
        ? spatialCoord(ctx.positions, patchIdx, resolution)
        : scopeCellCoord(ctx.positions, patchIdx, scope, bounds)
      const u = width > 1 ? (cellX + 0.5) / width : 0.5
      const v = height > 1 ? (cellY + 0.5) / height : 0.5

      const du = u - cu
      const dv = v - cv
      const ru = cos * du + sin * dv + cu
      const rv = -sin * du + cos * dv + cv
      const cx = Math.min(width - 1, Math.max(0, Math.floor(ru * width)))
      const cy = Math.min(height - 1, Math.max(0, Math.floor(rv * height)))
      const j = cellMap.get(cy * width + cx) ?? li
      const [r, g, b] = readScopedRgb(src, scope, j)
      writeScopedRgb(out, scope, li, r, g, b)
    }
    return { pixels: out }
  }
}
