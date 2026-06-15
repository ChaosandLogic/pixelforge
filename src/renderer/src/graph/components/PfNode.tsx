import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeType } from '@shared/graph/registry'
import { isNodePreviewEnabled } from '@shared/graph/preview'
import type { ColourValue } from '@shared/graph/types'
import { type PfNode as PfNodeType } from '@/store/graphStore'
import { NodePreview } from './NodePreview'
import { NodePreviewButtons } from './NodePreviewButtons'
import { NodeProfilerBadge } from './NodeProfilerBadge'

function isColour(v: unknown): v is ColourValue {
  return typeof v === 'object' && v !== null && 'r' in v
}

function PfNodeComponent({ id, data, selected }: NodeProps<PfNodeType>): React.JSX.Element {
  const def = getNodeType(data.nodeType)

  if (def === undefined) {
    return <div className="pf-node error">Unknown: {data.nodeType}</div>
  }

  const swatches = def.params.filter((p) => p.type === 'colour').map((p) => data.params[p.name])
  const primaryOut = def.outputs[0]
  const previewKind = primaryOut?.type === 'pixels' ? 'pixels' : primaryOut?.type === 'float' ? 'float' : null
  const previewOn = isNodePreviewEnabled(data.preview)

  return (
    <div className={selected ? 'pf-node selected' : 'pf-node'} data-category={def.category}>
      <div className="pf-node-header">
        <span className="pf-node-title">{def.label}</span>
        <span className="pf-node-header-right">
          <NodeProfilerBadge nodeId={id} />
          {swatches.length > 0 && (
            <span className="pf-node-swatches">
              {swatches.map((c, i) =>
                isColour(c) ? (
                  <span key={i} className="pf-swatch" style={{ background: `rgb(${c.r},${c.g},${c.b})` }} />
                ) : null
              )}
            </span>
          )}
          {previewKind !== null && <NodePreviewButtons nodeId={id} nodeType={data.nodeType} />}
        </span>
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

      {previewOn && previewKind !== null && (
        <div className="pf-node-preview">
          <NodePreview nodeId={id} nodeType={data.nodeType} kind={previewKind} />
        </div>
      )}
    </div>
  )
}

export const PfNode = memo(PfNodeComponent)
