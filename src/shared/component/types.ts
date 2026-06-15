import type { EdgeData, NodeData } from '../graph/types'

/** Embedded graph stored on a Component node. */
export interface ComponentGraphData {
  nodes: NodeData[]
  edges: EdgeData[]
  /** Internal node whose primary pixels output is the component result. */
  outputNodeId: string
  outputPort?: string
}

const COMPONENT_OUT_TYPE = 'setup/component-out'

export function parseComponentGraph(value: unknown): ComponentGraphData {
  if (typeof value !== 'object' || value === null) return defaultComponentGraph()
  const o = value as Partial<ComponentGraphData>
  if (!Array.isArray(o.nodes) || !Array.isArray(o.edges) || typeof o.outputNodeId !== 'string') {
    return defaultComponentGraph()
  }
  return {
    nodes: o.nodes,
    edges: o.edges,
    outputNodeId: o.outputNodeId,
    outputPort: typeof o.outputPort === 'string' ? o.outputPort : 'pixels'
  }
}

/** Passthrough subgraph: external pixels in → component out. */
export function defaultComponentGraph(): ComponentGraphData {
  const inId = 'comp-in'
  const outId = 'comp-out'
  return {
    nodes: [
      {
        id: inId,
        type: 'setup/component-in',
        position: { x: 40, y: 80 },
        params: { source: 'pixels' }
      },
      {
        id: outId,
        type: COMPONENT_OUT_TYPE,
        position: { x: 320, y: 80 },
        params: {}
      }
    ],
    edges: [
      {
        id: 'comp-e1',
        fromNode: inId,
        fromPort: 'pixels',
        toNode: outId,
        toPort: 'pixels'
      }
    ],
    outputNodeId: outId,
    outputPort: 'pixels'
  }
}

/** Resolve output node id from a subgraph (prefers Component Out). */
export function detectComponentOutput(graph: ComponentGraphData): ComponentGraphData {
  const outNode = graph.nodes.find((n) => n.type === COMPONENT_OUT_TYPE)
  if (outNode !== undefined) {
    return { ...graph, outputNodeId: outNode.id, outputPort: 'pixels' }
  }
  return graph
}
