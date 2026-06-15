import { getNodeType } from './registry'
import { SCHEDULE_NODE_TYPE } from './nodes/schedule/Schedule'
import type { GraphData, NodeData, ParamBinding, ParamValues } from './types'

export interface FloatSourceOption {
  nodeId: string
  nodeLabel: string
  port: string
  portLabel: string
}

function nodeLabel(node: NodeData): string {
  if (node.label !== undefined && node.label !== '') return node.label
  const def = getNodeType(node.type)
  const base = def?.label ?? node.type
  const suffix = node.id.length > 6 ? node.id.slice(-4) : node.id
  return `${base} ${suffix}`
}

/** List all float output ports on a node (for binding pickers). */
export function floatOutputsForNode(node: NodeData): FloatSourceOption[] {
  const def = getNodeType(node.type)
  if (def === undefined) return []
  const label = nodeLabel(node)
  const options: FloatSourceOption[] = []

  for (const port of def.outputs) {
    if (port.type === 'float') {
      options.push({ nodeId: node.id, nodeLabel: label, port: port.name, portLabel: port.label })
    }
  }

  if (node.type === SCHEDULE_NODE_TYPE) {
    options.push({ nodeId: node.id, nodeLabel: label, port: 'index', portLabel: 'Active slot' })
  }

  return options
}

/** All bindable float sources in the graph (excluding targetNodeId). */
export function listFloatSources(nodes: NodeData[], excludeNodeId?: string): FloatSourceOption[] {
  const out: FloatSourceOption[] = []
  for (const node of nodes) {
    if (node.id === excludeNodeId) continue
    out.push(...floatOutputsForNode(node))
  }
  return out.sort((a, b) => a.nodeLabel.localeCompare(b.nodeLabel))
}

export function formatBindingRef(nodes: NodeData[], binding: ParamBinding): string {
  const src = nodes.find((n) => n.id === binding.fromNode)
  if (src === undefined) return `${binding.fromNode}.${binding.fromPort}`
  const match = floatOutputsForNode(src).find((o) => o.port === binding.fromPort)
  if (match !== undefined) return `${match.nodeLabel} · ${match.portLabel}`
  return `${nodeLabel(src)} · ${binding.fromPort}`
}

export function bindingKey(binding: ParamBinding): string {
  return `${binding.fromNode}:${binding.fromPort}`
}

export function parseBindingKey(key: string): ParamBinding | null {
  const i = key.indexOf(':')
  if (i <= 0) return null
  return { fromNode: key.slice(0, i), fromPort: key.slice(i + 1) }
}

/** Build downstream adjacency including param bindings as virtual edges. */
export function downstreamAdjacency(graph: GraphData): Map<string, string[]> {
  const downstream = new Map<string, string[]>()
  const add = (from: string, to: string): void => {
    const list = downstream.get(from)
    if (list === undefined) downstream.set(from, [to])
    else list.push(to)
  }
  for (const edge of graph.edges) add(edge.fromNode, edge.toNode)
  for (const node of graph.nodes) {
    for (const binding of Object.values(node.paramBindings ?? {})) {
      add(binding.fromNode, node.id)
    }
  }
  return downstream
}

export function graphHasCycle(graph: GraphData): boolean {
  const downstream = downstreamAdjacency(graph)
  const WHITE = 0
  const GREY = 1
  const BLACK = 2
  const colour = new Map<string, number>()

  const visit = (id: string): boolean => {
    colour.set(id, GREY)
    for (const next of downstream.get(id) ?? []) {
      const c = colour.get(next) ?? WHITE
      if (c === GREY) return true
      if (c === WHITE && visit(next)) return true
    }
    colour.set(id, BLACK)
    return false
  }

  for (const node of graph.nodes) {
    if ((colour.get(node.id) ?? WHITE) === WHITE && visit(node.id)) return true
  }
  return false
}

/** True if adding this binding would create a cycle. */
export function wouldBindingCycle(
  graph: GraphData,
  targetNodeId: string,
  binding: ParamBinding
): boolean {
  if (binding.fromNode === targetNodeId) return true
  const downstream = downstreamAdjacency(graph)
  const stack = [targetNodeId]
  const seen = new Set<string>()
  while (stack.length > 0) {
    const id = stack.pop() as string
    if (id === binding.fromNode) return true
    if (seen.has(id)) continue
    seen.add(id)
    for (const next of downstream.get(id) ?? []) stack.push(next)
  }
  return false
}

export function isValidFloatBinding(
  graph: GraphData,
  targetNodeId: string,
  paramName: string,
  binding: ParamBinding
): string | null {
  const target = graph.nodes.find((n) => n.id === targetNodeId)
  if (target === undefined) return 'Target node not found'
  const def = getNodeType(target.type)
  if (def === undefined) return 'Unknown node type'
  const param = def.params.find((p) => p.name === paramName)
  if (param === undefined) return 'Unknown parameter'
  if (param.type !== 'float' && param.type !== 'int') return 'Only float/int params can be bound'

  const src = graph.nodes.find((n) => n.id === binding.fromNode)
  if (src === undefined) return 'Source node not found'
  const sources = floatOutputsForNode(src)
  if (!sources.some((s) => s.port === binding.fromPort)) return 'Source port is not a float output'

  if (wouldBindingCycle(graph, targetNodeId, binding)) return 'Binding would create a cycle'
  return null
}

/** Apply param bindings; wired input ports take precedence over bindings. */
export function applyParamBindings(
  node: NodeData,
  inputs: Record<string, unknown>,
  params: ParamValues,
  resolveOutput: (nodeId: string, port: string) => unknown
): ParamValues {
  const out = { ...params }
  const bindings = node.paramBindings ?? {}
  for (const [paramName, binding] of Object.entries(bindings)) {
    if (inputs[paramName] !== null && inputs[paramName] !== undefined) continue
    const v = resolveOutput(binding.fromNode, binding.fromPort)
    if (typeof v === 'number') {
      out[paramName] = v
      inputs[paramName] = v
    }
  }
  return out
}
