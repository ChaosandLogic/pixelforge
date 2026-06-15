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
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }

    const angleTurns =
      floatInput(inputs, params, 'angle') + (ctx.timeMs / 1000) * floatParam(params, 'speed')
    const theta = angleTurns * Math.PI * 2
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    const cu = floatParam(params, 'centreU', 0.5)
    const cv = floatParam(params, 'centreV', 0.5)
    const resolution = resolutionInput(inputs, ctx)
    const { width, height } = resolution
    const n = ctx.pixelCount

    const cellMap = new Map<number, number>()
    for (let j = 0; j < n; j++) {
      const { cellX, cellY } = spatialCoord(ctx.positions, j, resolution)
      const key = cellY * width + cellX
      if (!cellMap.has(key)) cellMap.set(key, j)
    }

    for (let i = 0; i < n; i++) {
      const { u, v } = spatialCoord(ctx.positions, i, resolution)
      const du = u - cu
      const dv = v - cv
      const ru = cos * du + sin * dv + cu
      const rv = -sin * du + cos * dv + cv
      const cx = Math.min(width - 1, Math.max(0, Math.floor(ru * width)))
      const cy = Math.min(height - 1, Math.max(0, Math.floor(rv * height)))
      const j = cellMap.get(cy * width + cx) ?? i
      out[i * 3] = src[j * 3] ?? 0
      out[i * 3 + 1] = src[j * 3 + 1] ?? 0
      out[i * 3 + 2] = src[j * 3 + 2] ?? 0
    }
    return { pixels: out }
  }
}
