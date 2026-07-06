import { memo, useMemo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeType } from '@shared/graph/registry'
import { isNodePreviewEnabled } from '@shared/graph/preview'
import { activeSegmentPorts } from '@shared/graph/nodes/sequence/Sequence'
import { TIMELINE_NODE_TYPE, timelineLoop } from '@shared/graph/nodes/time/Timeline'
import { sequenceLengthBeats } from '@shared/sequence/evaluate'
import {
  MAX_SEQUENCE_SEGMENTS,
  parseSegments,
  type SequenceSegment,
  type TransitionCurve,
  type TransitionType
} from '@shared/sequence/types'
import { useGraphStore, type PfNode as PfNodeType } from '@/store/graphStore'
import { NodePreview } from './NodePreview'
import { NodePreviewButtons } from './NodePreviewButtons'
import { NodeProfilerBadge } from './NodeProfilerBadge'

function SequenceNodeComponent({ id, data, selected }: NodeProps<PfNodeType>): React.JSX.Element {
  const updateParam = useGraphStore((s) => s.updateParam)
  const nodes = useGraphStore((s) => s.nodes)
  const def = getNodeType(data.nodeType)
  const segments = parseSegments(data.params['segments'])
  const previewOn = isNodePreviewEnabled(data.preview)
  const totalBeats = useMemo(() => sequenceLengthBeats(segments), [segments])
  const timelineLoopBeats = useMemo(() => {
    const timeline = nodes.find(
      (n) => n.data.nodeType === TIMELINE_NODE_TYPE && n.data.params['loop'] !== false
    )
    if (timeline === undefined) return null
    return timelineLoop(timeline.data.params).loopBeats
  }, [nodes])

  if (def === undefined) {
    return <div className="pf-node error">Unknown: {data.nodeType}</div>
  }

  const segmentPorts = activeSegmentPorts(segments)
  const visibleInputs = [
    ...segmentPorts,
    ...def.inputs.filter((p) => p.name === 'beat' || p.name === 'clock' || p.name === 'reset' || p.name === 'intensity')
  ]

  const setSegments = (next: SequenceSegment[]): void => {
    updateParam(id, 'segments', next)
  }

  const updateSegment = (index: number, patch: Partial<SequenceSegment>): void => {
    const next = segments.map((s, i) => (i === index ? { ...s, ...patch } : s))
    setSegments(next)
  }

  const updateTransition = (index: number, patch: Partial<SequenceSegment['transition']>): void => {
    const seg = segments[index]
    if (seg === undefined) return
    updateSegment(index, { transition: { ...seg.transition, ...patch } })
  }

  const addSegment = (): void => {
    if (segments.length >= MAX_SEQUENCE_SEGMENTS) return
    setSegments([
      ...segments,
      {
        id: `seg${segments.length}`,
        duration: 4,
        transition: { type: 'crossfade', duration: 1, curve: 'ease-in-out' }
      }
    ])
  }

  const removeSegment = (index: number): void => {
    if (segments.length <= 1) return
    setSegments(segments.filter((_, i) => i !== index))
  }

  return (
    <div className={selected ? 'pf-node pf-sequence selected' : 'pf-node pf-sequence'} data-category="sequence">
      <div className="pf-node-header">
        <span className="pf-node-title">{def.label}</span>
        <span className="pf-node-header-right">
          <NodeProfilerBadge nodeId={id} />
          <NodePreviewButtons nodeId={id} nodeType={data.nodeType} />
        </span>
      </div>

      <div className="seq-segment-list nodrag">
        {segments.map((seg, i) => (
          <div key={seg.id} className="seq-segment-row">
            <span className="seq-segment-idx">{i + 1}</span>
            <label className="seq-field">
              <span>Beats</span>
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={seg.duration}
                onChange={(e) => updateSegment(i, { duration: Math.max(0.25, Number(e.target.value) || 4) })}
              />
            </label>
            <label className="seq-field">
              <span>{i === 0 ? 'Loop in' : 'In'}</span>
              <select
                value={seg.transition.type}
                onChange={(e) => updateTransition(i, { type: e.target.value as TransitionType })}
              >
                <option value="cut">Cut</option>
                <option value="crossfade">Crossfade</option>
                <option value="dissolve">Dissolve</option>
                <option value="wipe">Wipe</option>
              </select>
            </label>
            {seg.transition.type !== 'cut' && (
              <>
                <label className="seq-field narrow">
                  <span>×</span>
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    value={seg.transition.duration}
                    onChange={(e) =>
                      updateTransition(i, { duration: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </label>
                <label className="seq-field">
                  <span>Curve</span>
                  <select
                    value={seg.transition.curve}
                    onChange={(e) => updateTransition(i, { curve: e.target.value as TransitionCurve })}
                  >
                    <option value="linear">Linear</option>
                    <option value="ease-in">Ease in</option>
                    <option value="ease-out">Ease out</option>
                    <option value="ease-in-out">Ease in-out</option>
                  </select>
                </label>
              </>
            )}
            <button className="seq-remove" disabled={segments.length <= 1} onClick={() => removeSegment(i)}>
              ×
            </button>
          </div>
        ))}
        <button className="seq-add-segment" disabled={segments.length >= MAX_SEQUENCE_SEGMENTS} onClick={addSegment}>
          + Segment
        </button>
        <p className="schedule-hint">Total: {totalBeats.toFixed(2)} beats</p>
        {timelineLoopBeats !== null && Math.abs(timelineLoopBeats - totalBeats) > 0.05 && (
          <p className="schedule-hint timeline-align-hint">
            Timeline loop is {timelineLoopBeats.toFixed(2)} beats — wire Timeline beat in and match segment
            lengths for aligned loops.
          </p>
        )}
      </div>

      <div className="pf-node-ports">
        <div className="pf-ports-in">
          {visibleInputs.map((port) => (
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

export const SequenceNode = memo(SequenceNodeComponent)
