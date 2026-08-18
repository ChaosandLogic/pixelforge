import {
  beginScopedOutput,
  generatorScope,
  scopePatchIndex,
  scopeUv
} from '../../generatorScope'
import { floatParam, resolutionInput, stringParam, type NodeTypeDef } from '../../types'

export const IMAGE_NODE_TYPE = 'generator/image'

/** Params edited inline on the node card (hidden from Inspector). */
export const IMAGE_INLINE_PARAMS = new Set(['file'])

/**
 * Static image mapped across pixels. The GPU sidecar decodes the file;
 * CPU `evaluate()` samples a media-frame only when the sidecar is down.
 */
export const ImageFile: NodeTypeDef = {
  type: IMAGE_NODE_TYPE,
  label: 'Image',
  category: 'generator',
  description: 'Maps a still image across the pixels',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'file', label: 'File', type: 'file', default: '' },
    { name: 'gain', label: 'Gain', type: 'float', default: 1, min: 0, max: 2, step: 0.01 },
    {
      name: 'fit',
      label: 'Fit',
      type: 'select',
      default: 'cover',
      options: ['cover', 'contain', 'stretch']
    }
  ],
  gpu: { pass: 'generator/image' },
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
