import { stringParam, type NodeTypeDef, type PortValues } from '../../types'

export const COMPONENT_IN_NODE_TYPE = 'setup/component-in'

const SOURCE_OPTIONS = ['pixels', 'float0', 'float1', 'float2', 'resolution'] as const

/** Exposes a parent Component port inside the embedded subgraph. */
export const ComponentIn: NodeTypeDef = {
  type: COMPONENT_IN_NODE_TYPE,
  label: 'Component In',
  category: 'setup',
  description: 'Maps a parent Component input into this subgraph',
  inputs: [],
  outputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'float', label: 'Float', type: 'float' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  params: [
    {
      name: 'source',
      label: 'Source',
      type: 'select',
      default: 'pixels',
      options: [...SOURCE_OPTIONS]
    }
  ],
  evaluate(_inputs, params, ctx) {
    const source = stringParam(params, 'source', 'pixels')
    const external = ctx.componentInputs ?? {}
    const value = external[source] ?? null

    if (source === 'pixels') {
      return { pixels: value instanceof Float32Array ? value : null, float: 0, resolution: null }
    }
    if (source === 'resolution') {
      const res =
        typeof value === 'object' && value !== null && 'width' in value ? value : ctx.resolution
      return { pixels: null, float: 0, resolution: res }
    }
    return {
      pixels: null,
      float: typeof value === 'number' ? value : 0,
      resolution: null
    }
  }
}

export function componentInSource(params: PortValues): string {
  return typeof params['source'] === 'string' ? params['source'] : 'pixels'
}
