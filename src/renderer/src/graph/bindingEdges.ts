import type { Edge } from '@xyflow/react'
import { getNodeType } from '@shared/graph/registry'
import type { PfNode } from '@/store/graphStore'

const BINDING_EDGE_PREFIX = 'binding:'

export function isBindingEdgeId(id: string): boolean {
  return id.startsWith(BINDING_EDGE_PREFIX)
}

/** Visual edges for float/int params driven by another node's output. */
export function buildParamBindingEdges(nodes: PfNode[]): Edge[] {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges: Edge[] = []

  for (const node of nodes) {
    const bindings = node.data.paramBindings
    if (bindings === undefined) continue

    for (const [paramName, binding] of Object.entries(bindings)) {
      if (!nodeIds.has(binding.fromNode)) continue

      const def = getNodeType(node.data.nodeType)
      const paramLabel = def?.params.find((p) => p.name === paramName)?.label ?? paramName

      edges.push({
        id: `${BINDING_EDGE_PREFIX}${node.id}:${paramName}`,
        source: binding.fromNode,
        sourceHandle: binding.fromPort,
        target: node.id,
        type: 'smoothstep',
        selectable: false,
        deletable: false,
        focusable: false,
        interactionWidth: 0,
        className: 'binding-edge',
        label: paramLabel,
        labelStyle: { fill: '#7eb6ff', fontSize: 10 },
        labelBgStyle: { fill: '#151a22', fillOpacity: 0.92 },
        labelBgPadding: [4, 6] as [number, number],
        labelBgBorderRadius: 4,
        style: {
          stroke: '#7eb6ff',
          strokeWidth: 1.5,
          strokeDasharray: '6 4',
          opacity: 0.85
        }
      })
    }
  }

  return edges
}
