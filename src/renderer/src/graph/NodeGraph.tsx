import { useEffect } from 'react'
import { Background, BackgroundVariant, Controls, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { isValidConnection, useGraphStore } from '@/store/graphStore'
import { AddNodeMenu } from './AddNodeMenu'
import { PfNode } from './components/PfNode'
import { SequenceNode } from './components/SequenceNode'
import { AudioInNode } from './components/AudioInNode'
import { MediaFileNode } from './components/MediaFileNode'
import { OutputNode } from './components/OutputNode'
import { FixtureNode } from './components/FixtureNode'
import { ComponentNode } from './components/ComponentNode'
import { ScheduleNode } from './components/ScheduleNode'
import { engineBridge } from '@/engine/bridge'
import { SEQUENCE_NODE_TYPE } from '@shared/graph/nodes/sequence/Sequence'

const nodeTypes = {
  pf: PfNode,
  sequence: SequenceNode,
  schedule: ScheduleNode,
  audio: AudioInNode,
  media: MediaFileNode,
  output: OutputNode,
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
  const undo = useGraphStore((s) => s.undo)
  const redo = useGraphStore((s) => s.redo)
  const copySelectedNodes = useGraphStore((s) => s.copySelectedNodes)
  const pasteNodes = useGraphStore((s) => s.pasteNodes)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        copySelectedNodes()
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        pasteNodes()
        return
      }

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
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, copySelectedNodes, pasteNodes])

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
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={connect}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        defaultEdgeOptions={{ animated: false }}
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
