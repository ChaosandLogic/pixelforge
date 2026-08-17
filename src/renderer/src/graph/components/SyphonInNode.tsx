import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeType } from '@shared/graph/registry'
import { isNodePreviewEnabled } from '@shared/graph/preview'
import { useEngineStore } from '@/store/engineStore'
import { useGraphStore, type PfNode as PfNodeType } from '@/store/graphStore'
import { NodePreview } from './NodePreview'
import { NodePreviewButtons } from './NodePreviewButtons'
import { NodeProfilerBadge } from './NodeProfilerBadge'

function SyphonInNodeComponent({ id, data, selected }: NodeProps<PfNodeType>): React.JSX.Element {
  const updateParam = useGraphStore((s) => s.updateParam)
  const def = getNodeType(data.nodeType)
  const sender = typeof data.params['sender'] === 'string' ? data.params['sender'] : ''
  const shareAvailable = useEngineStore((s) => s.status.shareAvailable)
  const sharePlatform = useEngineStore((s) => s.status.sharePlatform)
  const shareSenders = useEngineStore((s) => s.status.shareSenders)
  const shareError = useEngineStore((s) => s.status.shareError)
  const previewOn = isNodePreviewEnabled(data.preview)

  if (def === undefined) {
    return <div className="pf-node error">Unknown: {data.nodeType}</div>
  }

  const protocol = sharePlatform === 'spout' ? 'Spout' : 'Syphon'
  const options = sender !== '' && !shareSenders.includes(sender) ? [sender, ...shareSenders] : shareSenders

  return (
    <div className={selected ? 'pf-node pf-media selected' : 'pf-node pf-media'} data-category="generator">
      <div className="pf-node-header">
        <span className="pf-node-title">{def.label}</span>
        <span className="pf-node-header-right">
          <NodeProfilerBadge nodeId={id} />
          <NodePreviewButtons nodeId={id} nodeType={data.nodeType} />
        </span>
      </div>

      <div className="media-file-controls nodrag">
        {!shareAvailable ? (
          <span className="media-file-btn" title={shareError ?? `${protocol} is not available`}>
            {shareError ?? `${protocol} unavailable`}
          </span>
        ) : (
          <select
            className="media-file-btn"
            value={sender}
            title={`${protocol} sender`}
            onChange={(e) => updateParam(id, 'sender', e.target.value)}
          >
            <option value="">Choose {protocol} sender…</option>
            {options.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
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
        <div className="pf-ports-out">
          {def.outputs.map((port) => (
            <div key={port.name} className="pf-port out">
              <span className="pf-port-label">{port.label}</span>
              <Handle
                id={port.name}
                type="source"
                position={Position.Right}
                className={`pf-handle pf-handle-${port.type}`}
              />
            </div>
          ))}
        </div>
      </div>

      {previewOn && (
        <div className="pf-node-preview">
          <NodePreview nodeId={id} nodeType={data.nodeType} kind="pixels" />
        </div>
      )}
    </div>
  )
}

export const SyphonInNode = memo(SyphonInNodeComponent)
