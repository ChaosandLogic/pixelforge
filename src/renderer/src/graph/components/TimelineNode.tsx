import { memo, useMemo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeType } from '@shared/graph/registry'
import { timelineLoop } from '@shared/graph/nodes/time/Timeline'
import { useGraphStore, type PfNode as PfNodeType } from '@/store/graphStore'
import { NodeProfilerBadge } from './NodeProfilerBadge'

function TimelineNodeComponent({ id, data, selected }: NodeProps<PfNodeType>): React.JSX.Element {
  const updateParam = useGraphStore((s) => s.updateParam)
  const def = getNodeType(data.nodeType)

  const durationMode =
    data.params['durationMode'] === 'beats' ? 'beats' : ('seconds' as 'seconds' | 'beats')
  const loop = data.params['loop'] !== false
  const bpm = typeof data.params['bpm'] === 'number' ? data.params['bpm'] : 120

  const { loopBeats, loopSec } = useMemo(() => timelineLoop(data.params), [data.params])

  if (def === undefined) {
    return <div className="pf-node error">Unknown: {data.nodeType}</div>
  }

  const rulerLabel = `${loopSec.toFixed(1)} s · ${loopBeats.toFixed(2)} beats @ ${bpm} BPM`

  return (
    <div className={selected ? 'pf-node pf-timeline selected' : 'pf-node pf-timeline'} data-category="time">
      <div className="pf-node-header">
        <span className="pf-node-title">{def.label}</span>
        <span className="pf-node-header-right">
          <NodeProfilerBadge nodeId={id} />
        </span>
      </div>

      <div className="timeline-controls nodrag">
        <label className="seq-field">
          <span>Mode</span>
          <select
            value={durationMode}
            onChange={(e) => updateParam(id, 'durationMode', e.target.value)}
          >
            <option value="seconds">Seconds</option>
            <option value="beats">Beats</option>
          </select>
        </label>

        {durationMode === 'seconds' ? (
          <label className="seq-field">
            <span>Duration</span>
            <input
              type="number"
              min={0.05}
              max={3600}
              step={0.1}
              value={typeof data.params['durationSec'] === 'number' ? data.params['durationSec'] : 8}
              onChange={(e) => updateParam(id, 'durationSec', Math.max(0.05, Number(e.target.value) || 8))}
            />
          </label>
        ) : (
          <label className="seq-field">
            <span>Beats</span>
            <input
              type="number"
              min={0.25}
              max={4096}
              step={0.25}
              value={typeof data.params['durationBeats'] === 'number' ? data.params['durationBeats'] : 8}
              onChange={(e) =>
                updateParam(id, 'durationBeats', Math.max(0.25, Number(e.target.value) || 8))
              }
            />
          </label>
        )}

        <label className="seq-field">
          <span>BPM</span>
          <input
            type="number"
            min={20}
            max={300}
            step={1}
            value={bpm}
            onChange={(e) => updateParam(id, 'bpm', Math.max(20, Math.min(300, Number(e.target.value) || 120)))}
          />
        </label>

        <label className="seq-field timeline-loop-field">
          <span>Loop</span>
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => updateParam(id, 'loop', e.target.checked)}
          />
        </label>
      </div>

      <div className="timeline-ruler nodrag" title={rulerLabel}>
        <div className="timeline-ruler-bar" />
        <span className="timeline-ruler-label">{rulerLabel}</span>
      </div>
      <p className="schedule-hint nodrag">
        Wire beat → Sequence. Align segment total to {loopBeats.toFixed(2)} beats for loop sync.
      </p>

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
    </div>
  )
}

export const TimelineNode = memo(TimelineNodeComponent)
