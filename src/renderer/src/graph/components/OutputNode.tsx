import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeType } from '@shared/graph/registry'
import { isOutputTransmitEnabled } from '@shared/output/config'
import { useGraphStore, type PfNode as PfNodeType } from '@/store/graphStore'
import { OutputSettingsForm } from '@/ui/OutputSettingsForm'
import { NodeProfilerBadge } from './NodeProfilerBadge'

function OutputNodeComponent({ id, data, selected }: NodeProps<PfNodeType>): React.JSX.Element {
  const updateParam = useGraphStore((s) => s.updateParam)
  const def = getNodeType(data.nodeType)

  if (def === undefined) {
    return <div className="pf-node error">Unknown: {data.nodeType}</div>
  }

  const transmitOn = isOutputTransmitEnabled(data.params)

  return (
    <div
      className={
        selected
          ? transmitOn
            ? 'pf-node pf-output selected'
            : 'pf-node pf-output selected muted'
          : transmitOn
            ? 'pf-node pf-output'
            : 'pf-node pf-output muted'
      }
      data-category="output"
    >
      <div className="pf-node-header">
        <span className="pf-node-title">{def.label}</span>
        <span className="pf-node-header-right">
          <button
            className={transmitOn ? 'pf-transmit nodrag active' : 'pf-transmit nodrag'}
            title={transmitOn ? 'Transmit on — click to disable' : 'Transmit off — click to enable'}
            onClick={(e) => {
              e.stopPropagation()
              updateParam(id, 'transmit', !transmitOn)
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M4.9 4.9a10 10 0 0 1 14.2 0" />
              <path d="M7.8 7.8a6 6 0 0 1 8.4 0" />
              <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <NodeProfilerBadge nodeId={id} />
        </span>
      </div>

      <div className="output-controls nodrag">
        <OutputSettingsForm nodeId={id} showTransmit={false} showBindInterface />
      </div>

      <div className="pf-node-ports">
        <div className="pf-ports-in">
          {def.inputs.map((port) => (
            <div key={port.name} className="pf-port">
              <Handle
                id={port.name}
                type="target"
                position={Position.Left}
                className={`pf-handle pf-handle-${port.type}`}
              />
              <span className="pf-port-label">{port.label}</span>
            </div>
          ))}
        </div>
        <div className="pf-ports-out" />
      </div>
    </div>
  )
}

export const OutputNode = memo(OutputNodeComponent)
