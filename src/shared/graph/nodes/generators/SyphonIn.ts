import {
  beginScopedOutput,
  generatorScope,
  scopePatchIndex,
  scopeUv
} from '../../generatorScope'
import { floatParam, resolutionInput, stringParam, type NodeTypeDef, type ParamValues } from '../../types'

export const SYPHON_IN_NODE_TYPE = 'generator/syphon-in'

export const SYPHON_IN_INLINE_PARAMS = new Set(['sender'])

/**
 * Samples a Syphon (macOS) or Spout (Windows) sender across the patch.
 * Frames are received in the engine host and stored as media-frames.
 */
export const SyphonIn: NodeTypeDef = {
  type: SYPHON_IN_NODE_TYPE,
  label: 'Syphon / Spout In',
  category: 'generator',
  description: 'Maps a Syphon (macOS) or Spout (Windows) sender across the pixels',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'sender', label: 'Sender', type: 'string', default: '' },
    { name: 'gain', label: 'Gain', type: 'float', default: 1, min: 0, max: 2, step: 0.01 },
    {
      name: 'fit',
      label: 'Fit',
      type: 'select',
      default: 'cover',
      options: ['cover', 'contain', 'stretch']
    }
  ],
  evaluate(inputs, params, ctx) {
    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    const frame = ctx.getMediaFrame(ctx.nodeId)
    if (frame === null || frame.width === 0 || frame.height === 0) {
      return { pixels: out }
    }

    const gain = floatParam(params, 'gain', 1)
    const fit = stringParam(params, 'fit', 'cover')
    const { width, height, data } = frame
    const resolution = resolutionInput(inputs, ctx)

    for (let i = 0; i < scope.count; i++) {
      const { u, v } = scopeUv(ctx.positions, i, scope)
      let su = u
      let sv = v

      if (fit === 'contain') {
        const aspect = width / height
        const patchAspect = resolution.width / Math.max(1, resolution.height)
        if (aspect > patchAspect) {
          const scale = patchAspect / aspect
          sv = (sv - 0.5) / scale + 0.5
        } else {
          const scale = aspect / patchAspect
          su = (su - 0.5) / scale + 0.5
        }
      } else if (fit === 'cover') {
        const aspect = width / height
        const patchAspect = resolution.width / Math.max(1, resolution.height)
        if (aspect > patchAspect) {
          const scale = aspect / patchAspect
          sv = (sv - 0.5) * scale + 0.5
        } else {
          const scale = patchAspect / aspect
          su = (su - 0.5) * scale + 0.5
        }
      }

      if (su < 0 || su > 1 || sv < 0 || sv > 1) continue

      const fx = Math.min(width - 1, Math.max(0, Math.round(su * (width - 1))))
      const fy = Math.min(height - 1, Math.max(0, Math.round(sv * (height - 1))))
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

export function syphonSenderName(params: ParamValues): string {
  return stringParam(params, 'sender', '').trim()
}
