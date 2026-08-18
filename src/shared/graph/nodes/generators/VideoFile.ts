import {
  beginScopedOutput,
  generatorScope,
  scopePatchIndex,
  scopeUv
} from '../../generatorScope'
import { floatParam, type NodeTypeDef } from '../../types'

export const VIDEO_NODE_TYPE = 'generator/video'

/** Params edited inline on the node card (hidden from Inspector). */
export const VIDEO_INLINE_PARAMS = new Set(['file'])

/**
 * Plays a video file. The GPU sidecar decodes frames (ffmpeg when present);
 * CPU `evaluate()` samples a media-frame only when the sidecar is down.
 */
export const VideoFile: NodeTypeDef = {
  type: VIDEO_NODE_TYPE,
  label: 'Video File',
  category: 'generator',
  description: 'Plays a video file mapped across the pixels',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'file', label: 'File', type: 'file', default: '' },
    { name: 'gain', label: 'Gain', type: 'float', default: 1, min: 0, max: 2, step: 0.01 }
  ],
  gpu: { pass: 'generator/video' },
  evaluate(inputs, params, ctx) {
    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    const frame = ctx.getMediaFrame(ctx.nodeId)
    if (frame === null || frame.width === 0 || frame.height === 0) {
      return { pixels: out }
    }

    const gain = floatParam(params, 'gain', 1)
    const { width, height, data } = frame

    for (let i = 0; i < scope.count; i++) {
      const { u, v } = scopeUv(ctx.positions, i, scope)
      const fx = Math.min(width - 1, Math.max(0, Math.round(u * (width - 1))))
      const fy = Math.min(height - 1, Math.max(0, Math.round(v * (height - 1))))
      const idx = (fy * width + fx) * 3
      const r = ((data[idx] ?? 0) / 255) * gain
      const g = ((data[idx + 1] ?? 0) / 255) * gain
      const b = ((data[idx + 2] ?? 0) / 255) * gain
      const dst = scopePatchIndex(scope, i) * 3
      out[dst] = r > 1 ? 1 : r
      out[dst + 1] = g > 1 ? 1 : g
      out[dst + 2] = b > 1 ? 1 : b
    }
    return { pixels: out }
  }
}
