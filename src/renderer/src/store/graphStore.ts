import { create } from 'zustand'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange
} from '@xyflow/react'
import { getNodeType } from '@shared/graph/registry'
import { registerStandardNodes, COMPONENT_NODE_TYPE } from '@shared/graph/nodes'
import { detectComponentOutput, parseComponentGraph } from '@shared/component/types'
import type { NodeData } from '@shared/graph/types'
import { defaultParams, type GraphData, type ParamBinding, type ParamValue, type PortDef } from '@shared/graph/types'
import { portsCompatible } from '@shared/graph/ports'
import {
  graphHasCycle,
  isValidFloatBinding,
  parseBindingKey
} from '@shared/graph/paramBinding'
import { isNodePreviewEnabled } from '@shared/graph/preview'
import { SEQUENCE_NODE_TYPE } from '@shared/graph/nodes/sequence/Sequence'
import { TIMELINE_NODE_TYPE } from '@shared/graph/nodes/time/Timeline'
import { SCHEDULE_NODE_TYPE } from '@shared/graph/nodes/schedule/Schedule'
import { parseScheduleSlots } from '@shared/schedule/types'
import { AUDIO_IN_NODE_TYPE } from '@shared/graph/nodes/audio/AudioIn'
import { KEYBOARD_IN_NODE_TYPE } from '@shared/graph/nodes/input/KeyboardIn'
import { IMAGE_NODE_TYPE } from '@shared/graph/nodes/generators/ImageFile'
import { VIDEO_NODE_TYPE } from '@shared/graph/nodes/generators/VideoFile'
import { SYPHON_IN_NODE_TYPE } from '@shared/graph/nodes/generators/SyphonIn'
import { SYPHON_OUT_NODE_TYPE } from '@shared/graph/nodes/output/SyphonOut'
import { FIXTURE_NODE_TYPE } from '@shared/graph/nodes/setup/Fixture'
import { OUTPUT_NODE_TYPE } from '@shared/graph/nodes/output/PixelOutput'
import { RESOLUTION_NODE_TYPE } from '@shared/spatial/resolution'
import { engineBridge, onEngineConnect } from '@/engine/bridge'
import { usePatchStore } from '@/store/patchStore'

// Must happen before the initial graph is built below.
registerStandardNodes()

interface PfNodeData extends Record<string, unknown> {
  /** Registry key ('type' is reserved by xyflow for the component type) */
  nodeType: string
  params: Record<string, ParamValue>
  /** Float/int params driven by another node's float output. */
  paramBindings?: Record<string, ParamBinding>
  /** Show a live output thumbnail on the node */
  preview?: boolean
  /** Pixel preview raster: effect thumbnail or physical LED layout. */
  previewView?: 'effect' | 'output' | 'patch'
}

function persistPreviewView(view?: 'effect' | 'output' | 'patch'): { previewView: 'output' } | Record<string, never> {
  return view === 'output' ? { previewView: 'output' as const } : {}
}

export type PfNode = Node<PfNodeData>

interface Snapshot {
  nodes: PfNode[]
  edges: Edge[]
  /** Component-edit context captured with the snapshot, so undo/redo restores
   * the correct canvas (main graph vs. a component subgraph). */
  componentEditId?: string | null
  componentParent?: Snapshot | null
}

const HISTORY_LIMIT = 50
const PASTE_OFFSET = { x: 48, y: 48 }

interface NodeClipboard {
  nodes: PfNode[]
  edges: Edge[]
}

let nodeClipboard: NodeClipboard | null = null

interface GraphState {
  nodes: PfNode[]
  edges: Edge[]
  past: Snapshot[]
  future: Snapshot[]
  /** When set, the canvas shows this component's embedded subgraph. */
  componentEditId: string | null
  componentParent: Snapshot | null

  onNodesChange: (changes: NodeChange<PfNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  connect: (conn: Connection) => void
  addNode: (type: string, position: { x: number; y: number }) => void
  updateParam: (nodeId: string, name: string, value: ParamValue) => void
  setParamBinding: (nodeId: string, paramName: string, bindingKeyValue: string) => string | null
  clearParamBinding: (nodeId: string, paramName: string) => void
  enterComponent: (nodeId: string) => void
  exitComponent: () => void
  togglePreview: (nodeId: string) => void
  togglePreviewView: (nodeId: string) => void
  copySelectedNodes: () => void
  pasteNodes: () => void
  selectAllNodes: () => void
  removeSelectedNodes: () => void
  resetToDefault: () => void
  undo: () => void
  redo: () => void
  toGraphData: () => GraphData
  loadGraphData: (graph: GraphData) => void
}

// --- engine sync (debounced) -------------------------------------------------

let syncRaf: number | null = null

function scheduleSync(get: () => GraphState): void {
  if (syncRaf !== null) return
  syncRaf = requestAnimationFrame(() => {
    syncRaf = null
    engineBridge.send({ type: 'set-graph', graph: get().toGraphData() })
  })
}

// --- snapshot helpers ----------------------------------------------------------

function cloneSnapshot(
  nodes: PfNode[],
  edges: Edge[],
  componentEditId: string | null = null,
  componentParent: Snapshot | null = null
): Snapshot {
  return structuredClone({ nodes, edges, componentEditId, componentParent })
}

/** Coalesce rapid param tweaks (slider drags) into one history entry. */
let lastParamSnap: { nodeId: string; name: string; at: number } | null = null

// --- initial graph ------------------------------------------------------------

function initialGraph(): { nodes: PfNode[]; edges: Edge[] } {
  const nodes: PfNode[] = [
    makeNode('generator/wave', { x: 60, y: 120 }),
    makeNode('output/pixel', { x: 420, y: 150 })
  ]
  const edges: Edge[] = [
    {
      id: `e-${crypto.randomUUID()}`,
      source: nodes[0]!.id,
      sourceHandle: 'pixels',
      target: nodes[1]!.id,
      targetHandle: 'pixels'
    }
  ]
  return { nodes, edges }
}

function nodeComponentType(type: string): 'pf' | 'sequence' | 'timeline' | 'schedule' | 'audio' | 'keyboard' | 'media' | 'output' | 'fixture' | 'component' | 'syphonIn' | 'syphonOut' {
  if (type === SEQUENCE_NODE_TYPE) return 'sequence'
  if (type === TIMELINE_NODE_TYPE) return 'timeline'
  if (type === SCHEDULE_NODE_TYPE) return 'schedule'
  if (type === AUDIO_IN_NODE_TYPE) return 'audio'
  if (type === KEYBOARD_IN_NODE_TYPE) return 'keyboard'
  if (type === IMAGE_NODE_TYPE || type === VIDEO_NODE_TYPE) return 'media'
  if (type === SYPHON_IN_NODE_TYPE) return 'syphonIn'
  if (type === OUTPUT_NODE_TYPE) return 'output'
  if (type === SYPHON_OUT_NODE_TYPE) return 'syphonOut'
  if (type === FIXTURE_NODE_TYPE) return 'fixture'
  if (type === COMPONENT_NODE_TYPE) return 'component'
  return 'pf'
}

function pfToNodeData(n: PfNode): NodeData {
  return {
    id: n.id,
    type: n.data.nodeType,
    position: n.position,
    params: n.data.params,
    ...(n.data.paramBindings !== undefined ? { paramBindings: n.data.paramBindings } : {}),
    ...(n.data.preview === false ? { preview: false } : {}),
    ...persistPreviewView(n.data.previewView)
  }
}

function nodeDataToPf(n: NodeData): PfNode {
  const def = getNodeType(n.type)
  const params = def !== undefined ? { ...defaultParams(def), ...n.params } : { ...n.params }
  if (n.type === COMPONENT_NODE_TYPE) {
    params['graph'] = parseComponentGraph(params['graph'])
  }
  return {
    id: n.id,
    type: nodeComponentType(n.type),
    position: n.position,
    data: {
      nodeType: n.type,
      params,
      ...(n.paramBindings !== undefined ? { paramBindings: { ...n.paramBindings } } : {}),
      ...(n.preview !== undefined ? { preview: n.preview } : {}),
      ...persistPreviewView(n.previewView)
    }
  }
}

function pfEdgesToGraph(edges: Edge[]): GraphData['edges'] {
  return edges.map((e) => ({
    id: e.id,
    fromNode: e.source,
    fromPort: e.sourceHandle ?? '',
    toNode: e.target,
    toPort: e.targetHandle ?? ''
  }))
}

function graphEdgesToPf(edges: GraphData['edges']): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.fromNode,
    sourceHandle: e.fromPort,
    target: e.toNode,
    targetHandle: e.toPort
  }))
}

function subgraphFromCanvas(nodes: PfNode[], edges: Edge[]) {
  return detectComponentOutput({
    nodes: nodes.map(pfToNodeData),
    edges: pfEdgesToGraph(edges),
    outputNodeId: '',
    outputPort: 'pixels'
  })
}

function graphDataFromPf(nodes: PfNode[], edges: Edge[]): GraphData {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.nodeType,
      position: { x: n.position.x, y: n.position.y },
      params: n.data.params,
      ...(n.data.paramBindings !== undefined && Object.keys(n.data.paramBindings).length > 0
        ? { paramBindings: n.data.paramBindings }
        : {}),
      ...(n.data.preview === false ? { preview: false } : {}),
      ...persistPreviewView(n.data.previewView)
    })),
    edges: pfEdgesToGraph(edges)
  }
}

function makeNode(type: string, position: { x: number; y: number }): PfNode {
  const def = getNodeType(type)
  const params = def !== undefined ? defaultParams(def) : {}
  if (type === RESOLUTION_NODE_TYPE) {
    const { resolution } = usePatchStore.getState()
    params['width'] = resolution.width
    params['height'] = resolution.height
  }
  if (type === FIXTURE_NODE_TYPE) {
    const fixtures = usePatchStore.getState().layout?.fixtures ?? []
    const usedIds = new Set(
      useGraphStore.getState().nodes
        .filter((n) => n.data.nodeType === FIXTURE_NODE_TYPE)
        .map((n) => n.data.params['fixtureId'])
        .filter((id): id is string => typeof id === 'string' && id !== '')
    )
    const unassigned = fixtures.find((f) => !usedIds.has(f.id))
    const target = unassigned ?? fixtures[fixtures.length - 1]
    if (target !== undefined) params['fixtureId'] = target.id
  }
  return {
    id: crypto.randomUUID(),
    type: nodeComponentType(type),
    position,
    data: { nodeType: type, params }
  }
}

// --- store ---------------------------------------------------------------------

export const useGraphStore = create<GraphState>((set, get) => {
  const pushHistory = (): void => {
    const { nodes, edges, past, componentEditId, componentParent } = get()
    const next = [...past, cloneSnapshot(nodes, edges, componentEditId, componentParent)]
    if (next.length > HISTORY_LIMIT) next.shift()
    set({ past: next, future: [] })
  }

  const initial = initialGraph()
  // Send the seed graph once the engine port connects (bridge queues until then).
  queueMicrotask(() => scheduleSync(get))

  onEngineConnect(() => {
    engineBridge.send({ type: 'set-graph', graph: get().toGraphData() })
  })

  return {
    nodes: initial.nodes,
    edges: initial.edges,
    past: [],
    future: [],
    componentEditId: null,
    componentParent: null,

    onNodesChange: (changes) => {
      if (changes.some((c) => c.type === 'remove')) pushHistory()
      let nextNodes = applyNodeChanges(changes, get().nodes)
      const removedIds = changes.filter((c) => c.type === 'remove').map((c) => c.id)
      if (removedIds.length > 0) {
        const removed = new Set(removedIds)
        nextNodes = nextNodes.map((n) => {
          const bindings = n.data.paramBindings
          if (bindings === undefined) return n
          const nextBindings = { ...bindings }
          let changed = false
          for (const [paramName, binding] of Object.entries(bindings)) {
            if (removed.has(binding.fromNode)) {
              delete nextBindings[paramName]
              changed = true
            }
          }
          if (!changed) return n
          const bindingKeys = Object.keys(nextBindings)
          const nextData =
            bindingKeys.length === 0
              ? (({ paramBindings: _removed, ...rest }) => rest)(n.data)
              : { ...n.data, paramBindings: nextBindings }
          return { ...n, data: nextData }
        })
      }
      set({ nodes: nextNodes })
      if (changes.some((c) => c.type === 'remove')) scheduleSync(get)
    },

    onEdgesChange: (changes) => {
      if (changes.some((c) => c.type === 'remove')) pushHistory()
      set({ edges: applyEdgeChanges(changes, get().edges) })
      if (changes.some((c) => c.type === 'remove')) scheduleSync(get)
    },

    connect: (conn) => {
      pushHistory()
      // One edge per input port: a new connection replaces the existing one.
      const edges = get().edges.filter(
        (e) => !(e.target === conn.target && e.targetHandle === conn.targetHandle)
      )
      set({ edges: addEdge(conn, edges) })
      scheduleSync(get)
    },

    addNode: (type, position) => {
      pushHistory()
      set({ nodes: [...get().nodes, makeNode(type, position)] })
      scheduleSync(get)
    },

    updateParam: (nodeId, name, value) => {
      const now = Date.now()
      const coalesce =
        lastParamSnap !== null &&
        lastParamSnap.nodeId === nodeId &&
        lastParamSnap.name === name &&
        now - lastParamSnap.at < 800
      if (!coalesce) pushHistory()
      lastParamSnap = { nodeId, name, at: now }

      set({
        nodes: get().nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, params: { ...n.data.params, [name]: value } } } : n
        )
      })
      engineBridge.send({ type: 'patch-node-params', nodeId, params: { [name]: value } })
    },

    setParamBinding: (nodeId, paramName, bindingKeyValue) => {
      if (bindingKeyValue === '') {
        get().clearParamBinding(nodeId, paramName)
        return null
      }
      const binding = parseBindingKey(bindingKeyValue)
      if (binding === null) return 'Invalid binding'
      const graph = get().toGraphData()
      const err = isValidFloatBinding(graph, nodeId, paramName, binding)
      if (err !== null) return err

      pushHistory()
      set({
        nodes: get().nodes.map((n) => {
          if (n.id !== nodeId) return n
          const paramBindings = { ...(n.data.paramBindings ?? {}), [paramName]: binding }
          return { ...n, data: { ...n.data, paramBindings } }
        })
      })
      scheduleSync(get)
      return null
    },

    clearParamBinding: (nodeId, paramName) => {
      const node = get().nodes.find((n) => n.id === nodeId)
      if (node?.data.paramBindings?.[paramName] === undefined) return

      pushHistory()
      set({
        nodes: get().nodes.map((n) => {
          if (n.id !== nodeId) return n
          const paramBindings = { ...(n.data.paramBindings ?? {}) }
          delete paramBindings[paramName]
          const { paramBindings: _prev, ...rest } = n.data
          const data =
            Object.keys(paramBindings).length === 0
              ? rest
              : { ...rest, paramBindings }
          return { ...n, data }
        })
      })
      scheduleSync(get)
    },

    enterComponent: (nodeId) => {
      if (get().componentEditId !== null) return
      const node = get().nodes.find((n) => n.id === nodeId)
      if (node?.data.nodeType !== COMPONENT_NODE_TYPE) return
      const graph = parseComponentGraph(node.data.params['graph'])
      pushHistory()
      set({
        componentEditId: nodeId,
        componentParent: cloneSnapshot(get().nodes, get().edges),
        nodes: graph.nodes.map(nodeDataToPf),
        edges: graphEdgesToPf(graph.edges)
      })
    },

    exitComponent: () => {
      const { componentEditId, componentParent, nodes, edges } = get()
      if (componentEditId === null || componentParent === null) return
      const graph = subgraphFromCanvas(nodes, edges)
      pushHistory()
      set({
        nodes: componentParent.nodes.map((n) =>
          n.id === componentEditId
            ? { ...n, data: { ...n.data, params: { ...n.data.params, graph } } }
            : n
        ),
        edges: componentParent.edges,
        componentEditId: null,
        componentParent: null
      })
      scheduleSync(get)
    },

    togglePreview: (nodeId) => {
      // View state — not part of undo history.
      set({
        nodes: get().nodes.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, preview: isNodePreviewEnabled(n.data.preview) ? false : true } }
            : n
        )
      })
      scheduleSync(get)
    },

    togglePreviewView: (nodeId) => {
      set({
        nodes: get().nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  previewView: n.data.previewView === 'output' ? 'effect' : 'output'
                }
              }
            : n
        )
      })
      scheduleSync(get)
    },

    copySelectedNodes: () => {
      const { nodes, edges } = get()
      const selected = nodes.filter((n) => n.selected)
      if (selected.length === 0) return

      const ids = new Set(selected.map((n) => n.id))
      nodeClipboard = {
        nodes: selected.map((n) => structuredClone({ ...n, selected: false })),
        edges: edges
          .filter((e) => ids.has(e.source) && ids.has(e.target))
          .map((e) => structuredClone(e))
      }
    },

    pasteNodes: () => {
      if (nodeClipboard === null || nodeClipboard.nodes.length === 0) return

      pushHistory()
      const idMap = new Map<string, string>()
      for (const node of nodeClipboard.nodes) {
        idMap.set(node.id, crypto.randomUUID())
      }

      const pastedNodes: PfNode[] = nodeClipboard.nodes.map((node) => {
        const newId = idMap.get(node.id) as string
        const data = structuredClone(node.data)
        if (data.paramBindings !== undefined) {
          const nextBindings = { ...data.paramBindings }
          for (const [paramName, binding] of Object.entries(nextBindings)) {
            const mapped = idMap.get(binding.fromNode)
            if (mapped !== undefined) {
              nextBindings[paramName] = { ...binding, fromNode: mapped }
            }
          }
          data.paramBindings = nextBindings
        }
        return {
          ...structuredClone(node),
          id: newId,
          selected: true,
          position: {
            x: node.position.x + PASTE_OFFSET.x,
            y: node.position.y + PASTE_OFFSET.y
          },
          data
        }
      })

      const pastedEdges: Edge[] = nodeClipboard.edges.map((edge) => ({
        ...structuredClone(edge),
        id: crypto.randomUUID(),
        source: idMap.get(edge.source) as string,
        target: idMap.get(edge.target) as string
      }))

      nodeClipboard = {
        nodes: nodeClipboard.nodes.map((node) => ({
          ...node,
          position: {
            x: node.position.x + PASTE_OFFSET.x,
            y: node.position.y + PASTE_OFFSET.y
          }
        })),
        edges: nodeClipboard.edges
      }

      set({
        nodes: [...get().nodes.map((n) => ({ ...n, selected: false })), ...pastedNodes],
        edges: [...get().edges, ...pastedEdges]
      })
      scheduleSync(get)
    },

    selectAllNodes: () => {
      set({ nodes: get().nodes.map((n) => (n.selected ? n : { ...n, selected: true })) })
    },

    removeSelectedNodes: () => {
      const selected = get().nodes.filter((n) => n.selected)
      if (selected.length === 0) return
      get().onNodesChange(selected.map((n) => ({ type: 'remove', id: n.id })))
    },

    resetToDefault: () => {
      const { nodes, edges } = initialGraph()
      set({
        nodes,
        edges,
        past: [],
        future: [],
        componentEditId: null,
        componentParent: null
      })
      scheduleSync(get)
    },

    undo: () => {
      const { past, future, nodes, edges, componentEditId, componentParent } = get()
      const prev = past[past.length - 1]
      if (prev === undefined) return
      set({
        past: past.slice(0, -1),
        future: [cloneSnapshot(nodes, edges, componentEditId, componentParent), ...future],
        nodes: prev.nodes,
        edges: prev.edges,
        componentEditId: prev.componentEditId ?? null,
        componentParent: prev.componentParent ?? null
      })
      scheduleSync(get)
    },

    redo: () => {
      const { past, future, nodes, edges, componentEditId, componentParent } = get()
      const next = future[0]
      if (next === undefined) return
      set({
        past: [...past, cloneSnapshot(nodes, edges, componentEditId, componentParent)],
        future: future.slice(1),
        nodes: next.nodes,
        edges: next.edges,
        componentEditId: next.componentEditId ?? null,
        componentParent: next.componentParent ?? null
      })
      scheduleSync(get)
    },

    toGraphData: () => {
      const { nodes, edges, componentEditId, componentParent } = get()
      if (componentEditId !== null && componentParent !== null) {
        const graph = subgraphFromCanvas(nodes, edges)
        const mergedNodes = componentParent.nodes.map((n) =>
          n.id === componentEditId
            ? { ...n, data: { ...n.data, params: { ...n.data.params, graph } } }
            : n
        )
        return graphDataFromPf(mergedNodes, componentParent.edges)
      }
      return graphDataFromPf(nodes, edges)
    },

    loadGraphData: (graph) => {
      pushHistory()
      set({
        componentEditId: null,
        componentParent: null,
        nodes: graph.nodes.map((n) => {
          const def = getNodeType(n.type)
          const params =
            def !== undefined ? { ...defaultParams(def), ...n.params } : { ...n.params }
          if (n.type === COMPONENT_NODE_TYPE) {
            params['graph'] = parseComponentGraph(params['graph'])
          }
          return {
            id: n.id,
            type: nodeComponentType(n.type),
            position: n.position,
            data: {
              nodeType: n.type,
              params,
              ...(n.paramBindings !== undefined ? { paramBindings: { ...n.paramBindings } } : {}),
              ...(n.preview !== undefined ? { preview: n.preview } : {}),
              ...persistPreviewView(n.previewView)
            }
          }
        }),
        edges: graphEdgesToPf(graph.edges)
      })
      scheduleSync(get)
    }
  }
})

// --- connection validation -------------------------------------------------------

function resolveInputPort(nodeType: string, portName: string): PortDef | undefined {
  const def = getNodeType(nodeType)
  if (def === undefined || portName === '') return undefined
  if (nodeType === SEQUENCE_NODE_TYPE && portName.startsWith('segment_')) {
    return { name: portName, type: 'pixels', label: portName }
  }
  return def.inputs.find((p) => p.name === portName)
}

function resolveOutputPort(node: PfNode, portName: string): PortDef | undefined {
  const def = getNodeType(node.data.nodeType)
  if (def === undefined || portName === '') return undefined
  if (node.data.nodeType === SCHEDULE_NODE_TYPE) {
    if (portName === 'index') return { name: 'index', type: 'float', label: 'Active slot' }
    if (portName.startsWith('slot_')) {
      const idx = Number.parseInt(portName.slice(5), 10)
      const slots = parseScheduleSlots(node.data.params['slots'])
      if (Number.isFinite(idx) && idx >= 0 && idx < slots.length) {
        const slot = slots[idx] as (typeof slots)[number]
        return { name: portName, type: 'trigger', label: slot.label }
      }
      return undefined
    }
  }
  return def.outputs.find((p) => p.name === portName)
}

/** Typed ports enforced at connection time + acyclicity check. */
export function isValidConnection(conn: Connection | Edge): boolean {
  const { nodes } = useGraphStore.getState()
  const source = nodes.find((n) => n.id === conn.source)
  const target = nodes.find((n) => n.id === conn.target)
  if (source === undefined || target === undefined) return false
  if (conn.source === conn.target) return false

  const sourceDef = getNodeType(source.data.nodeType)
  const targetDef = getNodeType(target.data.nodeType)
  if (sourceDef === undefined || targetDef === undefined) return false

  const outPort = resolveOutputPort(source, conn.sourceHandle ?? '')
  const inPort = resolveInputPort(target.data.nodeType, conn.targetHandle ?? '')
  if (outPort === undefined || inPort === undefined) return false
  if (!portsCompatible(outPort.type, inPort.type)) return false

  const graph = useGraphStore.getState().toGraphData()
  const testGraph: GraphData = {
    ...graph,
    edges: [
      ...graph.edges.filter(
        (e) => !(e.toNode === conn.target && e.toPort === (conn.targetHandle ?? ''))
      ),
      {
        id: '__connection-check__',
        fromNode: conn.source,
        fromPort: conn.sourceHandle ?? '',
        toNode: conn.target,
        toPort: conn.targetHandle ?? ''
      }
    ]
  }
  return !graphHasCycle(testGraph)
}
