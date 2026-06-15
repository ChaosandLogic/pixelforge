import { floatParam, stringParam, type NodeTypeDef, type ParamValues } from '../../types'

export const OSC_IN_NODE_TYPE = 'input/osc-in'

export const OscIn: NodeTypeDef = {
  type: OSC_IN_NODE_TYPE,
  label: 'OSC In',
  category: 'time',
  description: 'Receives a float from an OSC address (UDP)',
  inputs: [],
  outputs: [{ name: 'value', label: 'Value', type: 'float' }],
  params: [
    { name: 'address', label: 'Address', type: 'string', default: '/pixelforge/value' },
    { name: 'port', label: 'Port', type: 'int', default: 9000, min: 1024, max: 65535 },
    { name: 'default', label: 'Default', type: 'float', default: 0, min: 0, max: 1, step: 0.01 }
  ],
  evaluate(_inputs, params, ctx) {
    const state = ctx.getOscState(ctx.nodeId)
    const fallback = floatParam(params, 'default', 0)
    return { value: state?.value ?? fallback }
  }
}

export function oscAddress(params: ParamValues): string {
  return stringParam(params, 'address', '/pixelforge/value')
}

export function oscPort(params: ParamValues): number {
  const v = params['port']
  return typeof v === 'number' ? Math.floor(v) : 9000
}
