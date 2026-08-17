import { useEffect, useMemo } from 'react'
import { Background, BackgroundVariant, Controls, ReactFlow, ReactFlowProvider, type EdgeChange } from '@xyflow/react'
import { isValidConnection, useGraphStore } from '@/store/graphStore'
import { buildParamBindingEdges, isBindingEdgeId } from '@/graph/bindingEdges'
import { AddNodeMenu } from './AddNodeMenu'
import { PfNode } from './components/PfNode'
import { SequenceNode } from './components/SequenceNode'
import { TimelineNode } from './components/TimelineNode'
import { AudioInNode } from './components/AudioInNode'
import { MediaFileNode } from './components/MediaFileNode'
import { OutputNode } from './components/OutputNode'
import { FixtureNode } from './components/FixtureNode'
import { ComponentNode } from './components/ComponentNode'
import { ScheduleNode } from './components/ScheduleNode'
import { KeyboardInNode } from './components/KeyboardInNode'
import { SyphonInNode } from './components/SyphonInNode'
import { SyphonOutNode } from './components/SyphonOutNode'
import { engineBridge } from '@/engine/bridge'
import { SEQUENCE_NODE_TYPE } from '@shared/graph/nodes/sequence/Sequence'
import { TIMELINE_NODE_TYPE } from '@shared/graph/nodes/time/Timeline'

const nodeTypes = {
  pf: PfNode,
  sequence: SequenceNode,
  timeline: TimelineNode,
  schedule: ScheduleNode,
  audio: AudioInNode,
  keyboard: KeyboardInNode,
  media: MediaFileNode,
  output: OutputNode,
  syphonIn: SyphonInNode,
  syphonOut: SyphonOutNode,
  fixture: FixtureNode,
  component: ComponentNode
}

function GraphCanvas(): React.JSX.Element {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const componentEditId = useGraphStore((s) => s.componentEditId)
  const componentParent = useGraphStore((s) => s.componentParent)
  const exitComponent = useGraphStore((s) => s.exitComponent)
  const onNodesChange = useGraphStore((s) => s.onNodesChange)
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange)
  const connect = useGraphStore((s) => s.connect)

  const bindingEdges = useMemo(() => buildParamBindingEdges(nodes), [nodes])
  const displayEdges = useMemo(() => [...edges, ...bindingEdges], [edges, bindingEdges])

  const handleEdgesChange = (changes: EdgeChange[]): void => {
    const dataChanges = changes.filter((c) => !('id' in c && isBindingEdgeId(c.id)))
    if (dataChanges.length > 0) onEdgesChange(dataChanges)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if (e.key === ']' || e.key === 'ArrowRight') {
        const selected = useGraphStore.getState().nodes.filter((n) => n.selected)
        for (const node of selected) {
          if (node.data.nodeType === SEQUENCE_NODE_TYPE) {
            engineBridge.send({ type: 'trigger', nodeId: node.id, port: 'clock' })
          }
        }
      }
      if (e.key === 'Home' || (e.shiftKey && e.key === 'ArrowLeft')) {
        const selected = useGraphStore.getState().nodes.filter((n) => n.selected)
        for (const node of selected) {
          if (node.data.nodeType === SEQUENCE_NODE_TYPE) {
            engineBridge.send({ type: 'trigger', nodeId: node.id, port: 'reset' })
          }
          if (node.data.nodeType === TIMELINE_NODE_TYPE) {
            engineBridge.send({ type: 'trigger', nodeId: node.id, port: 'reset' })
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="graph-area">
      {componentEditId !== null && componentParent !== null && (
        <div className="component-breadcrumb">
          <button type="button" className="component-breadcrumb-back" onClick={() => exitComponent()}>
            ← Back to main graph
          </button>
          <span className="component-breadcrumb-label">Editing component</span>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={connect}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        defaultEdgeOptions={{ animated: false }}
        elevateEdgesOnSelect
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <AddNodeMenu />
    </div>
  )
}

export function NodeGraph(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <GraphCanvas />
    </ReactFlowProvider>
  )
}
