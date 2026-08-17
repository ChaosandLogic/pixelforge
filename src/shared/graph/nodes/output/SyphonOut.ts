import { intParam, stringParam, type NodeTypeDef, type ParamValues } from '../../types'

export const SYPHON_OUT_NODE_TYPE = 'output/syphon-out'

export const SYPHON_OUT_INLINE_PARAMS = new Set(['name', 'transmit'])

/**
 * Publishes the wired pixel stream as a Syphon (macOS) or Spout (Windows)
 * sender. Rasterisation happens in the engine host after evaluation.
 */
export const SyphonOut: NodeTypeDef = {
  type: SYPHON_OUT_NODE_TYPE,
  label: 'Syphon / Spout Out',
  category: 'output',
  description: 'Publishes pixels as a Syphon (macOS) or Spout (Windows) sender',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [],
  params: [
    { name: 'name', label: 'Sender name', type: 'string', default: 'PixelForge' },
    {
      name: 'mapping',
      label: 'Mapping',
      type: 'select',
      default: 'grid',
      options: ['grid', 'layout']
    },
    { name: 'width', label: 'Width', type: 'int', default: 256, min: 16, max: 1024 },
    { name: 'height', label: 'Height', type: 'int', default: 256, min: 16, max: 1024 },
    { name: 'transmit', label: 'Transmit', type: 'boolean', default: true }
  ],
  evaluate() {
    return {}
  }
}

export function syphonOutName(params: ParamValues): string {
  const name = stringParam(params, 'name', 'PixelForge').trim()
  return name === '' ? 'PixelForge' : name
}

export function syphonOutMapping(params: ParamValues): 'grid' | 'layout' {
  return stringParam(params, 'mapping', 'grid') === 'layout' ? 'layout' : 'grid'
}

export function syphonOutSize(params: ParamValues): { width: number; height: number } {
  return {
    width: Math.max(16, Math.min(1024, intParam(params, 'width', 256))),
    height: Math.max(16, Math.min(1024, intParam(params, 'height', 256)))
  }
}

export function isSyphonOutTransmitEnabled(params: ParamValues): boolean {
  return params['transmit'] !== false
}
