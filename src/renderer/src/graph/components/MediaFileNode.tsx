import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeType } from '@shared/graph/registry'
import { isNodePreviewEnabled } from '@shared/graph/preview'
import { IMAGE_NODE_TYPE } from '@shared/graph/nodes/generators/ImageFile'
import { useGraphStore, type PfNode as PfNodeType } from '@/store/graphStore'
import { NodePreview } from './NodePreview'
import { NodePreviewButtons } from './NodePreviewButtons'
import { NodeProfilerBadge } from './NodeProfilerBadge'

function basename(path: string, emptyLabel: string): string {
  if (path === '') return emptyLabel
  return path.split('/').pop() ?? path
}

function MediaFileNodeComponent({ id, data, selected }: NodeProps<PfNodeType>): React.JSX.Element {
  const updateParam = useGraphStore((s) => s.updateParam)
  const def = getNodeType(data.nodeType)

  if (def === undefined) {
    return <div className="pf-node error">Unknown: {data.nodeType}</div>
  }

  const isImage = data.nodeType === IMAGE_NODE_TYPE
  const filePath = typeof data.params['file'] === 'string' ? data.params['file'] : ''
  const primaryOut = def.outputs[0]
  const previewKind = primaryOut?.type === 'pixels' ? 'pixels' : null
  const previewOn = isNodePreviewEnabled(data.preview)

  const pickFile = (): void => {
    const pick = isImage ? window.pixelforge.pickImageFile() : window.pixelforge.pickVideoFile()
    void pick.then((picked) => {
      if (picked !== null) updateParam(id, 'file', picked)
    })
  }

  return (
    <div className={selected ? 'pf-node pf-media selected' : 'pf-node pf-media'} data-category={def.category}>
      <div className="pf-node-header">
        <span className="pf-node-title">{def.label}</span>
        <span className="pf-node-header-right">
          <NodeProfilerBadge nodeId={id} />
          {previewKind !== null && <NodePreviewButtons nodeId={id} nodeType={data.nodeType} />}
        </span>
      </div>

      <div className="media-file-controls nodrag">
        <button
          className="media-file-btn"
          title={filePath === '' ? (isImage ? 'Choose an image' : 'Choose a video') : filePath}
          onClick={pickFile}
        >
          {basename(filePath, isImage ? 'Choose image…' : 'Choose video…')}
        </button>
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

export const MediaFileNode = memo(MediaFileNodeComponent)
