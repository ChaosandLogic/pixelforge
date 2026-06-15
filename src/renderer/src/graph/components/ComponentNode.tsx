import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeType } from '@shared/graph/registry'
import { stringParam, type ParamValues } from '@shared/graph/types'
import { parseComponentGraph } from '@shared/component/types'
import { useGraphStore, type PfNode } from '@/store/graphStore'

export function ComponentNode({ id, data, selected }: NodeProps<PfNode>): React.JSX.Element {
  const def = getNodeType(data.nodeType)
  const enterComponent = useGraphStore((s) => s.enterComponent)
  const params = data.params as ParamValues
  const label = stringParam(params, 'label', 'Component')
  const graph = parseComponentGraph(params['graph'])
  const innerCount = graph.nodes.length

  return (
    <div className={selected ? 'pf-node pf-component selected' : 'pf-node pf-component'} data-category="setup">
      <div className="pf-node-header">
        <span className="pf-node-title">{label}</span>
        <span className="pf-node-badge">macro</span>
      </div>
      <p className="pf-component-desc">{def?.description}</p>
      <p className="pf-component-meta">{innerCount} node{innerCount === 1 ? '' : 's'} inside</p>
      <button
        type="button"
        className="pf-component-edit-btn"
        onClick={(e) => {
          e.stopPropagation()
          enterComponent(id)
        }}
      >
        Edit inside
      </button>
      {def?.inputs.map((port) => (
        <Handle key={port.name} id={port.name} type="target" position={Position.Left} className={`pf-handle pf-handle-${port.type}`} />
      ))}
      {def?.outputs.map((port) => (
        <Handle key={port.name} id={port.name} type="source" position={Position.Right} className={`pf-handle pf-handle-${port.type}`} />
      ))}
    </div>
  )
}
