import { applyParamBindings, graphHasCycle } from '../graph/paramBinding'
import { getNodeType } from '../graph/registry'
import type { ComponentGraphData } from './types'
import type { EvalContext, NodeData, PortValue, PortValues } from '../graph/types'

interface EdgeSource {
  fromNode: string
  fromPort: string
}

/**
 * Evaluate an embedded component subgraph in isolation.
 * Returns the pixels output from the graph's output node, or null.
 */
export function evaluateSubgraph(
  graph: ComponentGraphData,
  externalInputs: PortValues,
  parentNodeId: string,
  ctx: EvalContext,
  evalNodeImpl: (nodeId: string, memo: Map<string, PortValues>, subgraph: SubgraphContext) => PortValues
): PortValue | null {
  const subCtx: SubgraphContext = {
    nodesById: new Map(graph.nodes.map((n) => [n.id, n])),
    edgesByTarget: new Map<string, EdgeSource>(),
    parentNodeId
  }
  for (const edge of graph.edges) {
    subCtx.edgesByTarget.set(`${edge.toNode}:${edge.toPort}`, {
      fromNode: edge.fromNode,
      fromPort: edge.fromPort
    })
  }

  const miniGraph = { nodes: graph.nodes, edges: graph.edges }
  if (graphHasCycle(miniGraph)) return null
  if (!subCtx.nodesById.has(graph.outputNodeId)) return null

  const memo = new Map<string, PortValues>()
  const savedInputs = ctx.componentInputs
  ctx.componentInputs = externalInputs
  try {
    const outputs = evalNodeImpl(graph.outputNodeId, memo, subCtx)
    const port = graph.outputPort ?? 'pixels'
    const value = outputs[port] ?? null
    return value
  } finally {
    ctx.componentInputs = savedInputs ?? null
  }
}

export interface SubgraphContext {
  nodesById: Map<string, NodeData>
  edgesByTarget: Map<string, EdgeSource>
  parentNodeId: string
}

export function subgraphMemoKey(parentNodeId: string, internalId: string): string {
  return `${parentNodeId}::${internalId}`
}

export function evalSubgraphNode(
  nodeId: string,
  memo: Map<string, PortValues>,
  subCtx: SubgraphContext,
  ctx: EvalContext,
  evalNodeImpl: (nodeId: string, memo: Map<string, PortValues>, subgraph: SubgraphContext) => PortValues
): PortValues {
  const key = subgraphMemoKey(subCtx.parentNodeId, nodeId)
  const cached = memo.get(key)
  if (cached !== undefined) return cached

  memo.set(key, {})

  const node = subCtx.nodesById.get(nodeId)
  if (node === undefined) return {}
  const def = getNodeType(node.type)
  if (def === undefined) return {}

  const inputs: PortValues = {}
  for (const port of def.inputs) {
    const source = subCtx.edgesByTarget.get(`${nodeId}:${port.name}`)
    inputs[port.name] =
      source !== undefined
        ? (evalNodeImpl(source.fromNode, memo, subCtx)[source.fromPort] ?? null)
        : null
  }

  const savedNodeId = ctx.nodeId
  ctx.nodeId = `${subCtx.parentNodeId}::${nodeId}`
  const resolveOutput = (fromNode: string, fromPort: string): unknown =>
    evalNodeImpl(fromNode, memo, subCtx)[fromPort] ?? null
  const params = applyParamBindings(node, inputs, node.params, resolveOutput)
  const outputs = def.evaluate(inputs, params, ctx)
  ctx.nodeId = savedNodeId
  memo.set(key, outputs)
  return outputs
}
