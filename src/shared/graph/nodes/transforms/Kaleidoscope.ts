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
    const out = ctx.acquire()
    if (src === null) {
      out.fill(0)
      return { pixels: out }
    }

    const segments = intParam(params, 'segments', 6)
    const cu = floatParam(params, 'centreU', 0.5)
    const cv = floatParam(params, 'centreV', 0.5)
    const mode = stringParam(params, 'mode', 'mirror')
    const resolution = resolutionInput(inputs, ctx)
    const { width, height } = resolution
    const n = ctx.pixelCount

    const cellMap = new Map<number, number>()
    for (let j = 0; j < n; j++) {
      const { cellX, cellY } = spatialCoord(ctx.positions, j, resolution)
      cellMap.set(cellY * width + cellX, j)
    }

    const segAngle = (Math.PI * 2) / segments

    for (let i = 0; i < n; i++) {
      const { u, v } = spatialCoord(ctx.positions, i, resolution)
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
      const j = cellMap.get(cy * width + cx) ?? i
      out[i * 3] = src[j * 3] ?? 0
      out[i * 3 + 1] = src[j * 3 + 1] ?? 0
      out[i * 3 + 2] = src[j * 3 + 2] ?? 0
    }
    return { pixels: out }
  }
}
