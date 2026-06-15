import { defaultComponentGraph, parseComponentGraph } from '../../../component/types'
import {
  floatInput,
  pixelsInput,
  resolutionInput,
  type NodeTypeDef,
  type PortValues
} from '../../types'

export const COMPONENT_NODE_TYPE = 'setup/component'

export const Component: NodeTypeDef = {
  type: COMPONENT_NODE_TYPE,
  label: 'Component',
  category: 'setup',
  description: 'Reusable subgraph macro with exposed inputs and a pixels output',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'float0', label: 'Float 0', type: 'float' },
    { name: 'float1', label: 'Float 1', type: 'float' },
    { name: 'float2', label: 'Float 2', type: 'float' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    { name: 'label', label: 'Name', type: 'string', default: 'Component' },
    { name: 'graph', label: 'Graph', type: 'component', default: defaultComponentGraph() }
  ],
  evaluate(inputs, params, ctx) {
    const graph = parseComponentGraph(params['graph'])
    const externalInputs: PortValues = {
      pixels: pixelsInput(inputs, 'pixels'),
      float0: floatInput(inputs, params, 'float0', 0),
      float1: floatInput(inputs, params, 'float1', 0),
      float2: floatInput(inputs, params, 'float2', 0),
      resolution: resolutionInput(inputs, ctx)
    }

    const result = ctx.evalSubgraph(graph, externalInputs)
    const out = ctx.acquire()
    if (result instanceof Float32Array) {
      out.set(result)
    } else {
      out.fill(0)
    }
    return { pixels: out }
  }
}
