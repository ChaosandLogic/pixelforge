import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeType } from '@shared/graph/registry'
import { FIXTURE_NODE_TYPE } from '@shared/graph/nodes/setup/Fixture'
import { fixturePointCount } from '@shared/patch/layout'
import { useGraphStore, type PfNode as PfNodeType } from '@/store/graphStore'
import { usePatchStore } from '@/store/patchStore'
import { NodePreview } from './NodePreview'
import { NodePreviewButtons } from './NodePreviewButtons'
import { NodeProfilerBadge } from './NodeProfilerBadge'

function FixtureNodeComponent({ id, data, selected }: NodeProps<PfNodeType>): React.JSX.Element {
  const updateParam = useGraphStore((s) => s.updateParam)
  const layout = usePatchStore((s) => s.layout)
  const def = getNodeType(data.nodeType)

  if (def === undefined) {
    return <div className="pf-node error">Unknown: {data.nodeType}</div>
  }

  const fixtures = layout?.fixtures ?? []
  const fixtureId =
    typeof data.params['fixtureId'] === 'string' && data.params['fixtureId'] !== ''
      ? data.params['fixtureId']
      : (fixtures[0]?.id ?? '')
  const fixture = fixtures.find((f) => f.id === fixtureId)
  const px = fixture !== undefined ? fixturePointCount(fixture.def) : 0

  return (
    <div className={selected ? 'pf-node pf-fixture selected' : 'pf-node pf-fixture'} data-category="setup">
      <div className="pf-node-header">
        <span className="pf-node-title">{def.label}</span>
        <span className="pf-node-header-right">
          <NodeProfilerBadge nodeId={id} />
          <NodePreviewButtons nodeId={id} nodeType={FIXTURE_NODE_TYPE} showEye={false} />
        </span>
      </div>

      <div className="fixture-controls nodrag">
        {fixtures.length === 0 ? (
          <p className="fixture-controls-hint">Add fixtures in the layout builder</p>
        ) : (
          <>
            <label className="output-field">
              <span>Target</span>
              <select
                value={fixtureId}
                onChange={(e) => updateParam(id, 'fixtureId', e.target.value)}
              >
                {fixtures.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.def.kind})
                  </option>
                ))}
              </select>
            </label>
            <p className="fixture-controls-meta">{px} px · scope at chain start, or map in at end</p>
          </>
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

      <div className="pf-node-preview">
        <NodePreview nodeId={id} nodeType={FIXTURE_NODE_TYPE} kind="pixels" />
      </div>
    </div>
  )
}

export const FixtureNode = memo(FixtureNodeComponent)
