import { scopeBounds, scopeCellCoord } from '../../generatorScope'
import {
  beginScopedPixelOutput,
  pixelScopeFromSrc,
  readScopedRgb,
  scopedResolution,
  writeScopedRgb
} from '../../pixelScope'
import { spatialCoord } from '../../../spatial/resolution'
import { floatParam, intParam, pixelsInput, resolutionInput, stringParam, type NodeTypeDef } from '../../types'

export const Kaleidoscope: NodeTypeDef = {
  type: 'transform/kaleidoscope',
  label: 'Kaleidoscope',
  category: 'transform',
  description: 'Mirror-repeat UV into radial segments',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'segments', label: 'Segments', type: 'int', default: 6, min: 2, max: 32 },
    { name: 'centreU', label: 'Centre U', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
    { name: 'centreV', label: 'Centre V', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
    {
      name: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'mirror',
      options: ['mirror', 'wrap']
    }
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
    const segments = intParam(params, 'segments', 6)
    const cu = floatParam(params, 'centreU', 0.5)
    const cv = floatParam(params, 'centreV', 0.5)
    const mode = stringParam(params, 'mode', 'mirror')
    const { width, height } = resolution
    const bounds = scope.fullPatch ? undefined : scopeBounds(ctx.positions, scope)

    const cellMap = new Map<number, number>()
    for (let li = 0; li < scope.count; li++) {
      const patchIdx = scope.indices[li] as number
      const { cellX, cellY } = scope.fullPatch
        ? spatialCoord(ctx.positions, patchIdx, resolution)
        : scopeCellCoord(ctx.positions, patchIdx, scope, bounds)
      cellMap.set(cellY * width + cellX, li)
    }

    const segAngle = (Math.PI * 2) / segments
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
      let angle = Math.atan2(dv, du)
      if (angle < 0) angle += Math.PI * 2
      const radius = Math.sqrt(du * du + dv * dv)

      let seg = angle / segAngle
      const segIndex = Math.floor(seg)
      let local = seg - segIndex
      if (mode === 'mirror' && segIndex % 2 === 1) local = 1 - local
      const foldedAngle = (segIndex % segments + local) * segAngle

      const ru = Math.cos(foldedAngle) * radius + cu
      const rv = Math.sin(foldedAngle) * radius + cv
      const cx = Math.min(width - 1, Math.max(0, Math.floor(ru * width)))
      const cy = Math.min(height - 1, Math.max(0, Math.floor(rv * height)))
      const j = cellMap.get(cy * width + cx) ?? li
      const [r, g, b] = readScopedRgb(src, scope, j)
      writeScopedRgb(out, scope, li, r, g, b)
    }
    return { pixels: out }
  }
}
