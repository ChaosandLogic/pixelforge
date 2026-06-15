import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeType } from '@shared/graph/registry'
import { isNodePreviewEnabled } from '@shared/graph/preview'
import {
  activeScheduleOutputs,
  SCHEDULE_NODE_TYPE
} from '@shared/graph/nodes/schedule/Schedule'
import {
  MAX_SCHEDULE_SLOTS,
  parseScheduleSlots,
  WEEKDAY_LABELS,
  type ScheduleSlot,
  type Weekday
} from '@shared/schedule/types'
import { useGraphStore, type PfNode as PfNodeType } from '@/store/graphStore'
import { NodePreview } from './NodePreview'
import { NodeProfilerBadge } from './NodeProfilerBadge'

function ScheduleNodeComponent({ id, data, selected }: NodeProps<PfNodeType>): React.JSX.Element {
  const togglePreview = useGraphStore((s) => s.togglePreview)
  const updateParam = useGraphStore((s) => s.updateParam)
  const def = getNodeType(data.nodeType)
  const slots = parseScheduleSlots(data.params['slots'])
  const enabled = data.params['enabled'] !== false
  const previewOn = isNodePreviewEnabled(data.preview)

  if (def === undefined) {
    return <div className="pf-node error">Unknown: {data.nodeType}</div>
  }

  const outputPorts = activeScheduleOutputs(slots)

  const setSlots = (next: ScheduleSlot[]): void => {
    updateParam(id, 'slots', next)
  }

  const updateSlot = (index: number, patch: Partial<ScheduleSlot>): void => {
    const next = slots.map((s, i) => (i === index ? { ...s, ...patch } : s))
    setSlots(next)
  }

  const toggleDay = (index: number, day: Weekday): void => {
    const slot = slots[index]
    if (slot === undefined) return
    if (slot.days.length === 0) {
      const all: Weekday[] = [0, 1, 2, 3, 4, 5, 6]
      updateSlot(index, { days: all.filter((d) => d !== day) })
      return
    }
    const has = slot.days.includes(day)
    const days = has ? slot.days.filter((d) => d !== day) : [...slot.days, day].sort((a, b) => a - b)
    updateSlot(index, { days: days.length === 7 ? [] : days })
  }

  const addSlot = (): void => {
    if (slots.length >= MAX_SCHEDULE_SLOTS) return
    setSlots([
      ...slots,
      {
        id: `slot${slots.length}`,
        label: `Slot ${slots.length + 1}`,
        time: '12:00',
        days: []
      }
    ])
  }

  const removeSlot = (index: number): void => {
    if (slots.length <= 1) return
    setSlots(slots.filter((_, i) => i !== index))
  }

  return (
    <div className={selected ? 'pf-node pf-schedule selected' : 'pf-node pf-schedule'} data-category="time">
      <div className="pf-node-header">
        <span className="pf-node-title">{def.label}</span>
        <span className="pf-node-header-right">
          <label className="schedule-enabled nodrag" title="Enable schedule">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => updateParam(id, 'enabled', e.target.checked)}
            />
            On
          </label>
          <NodeProfilerBadge nodeId={id} />
          <button
            className={previewOn ? 'pf-eye nodrag active' : 'pf-eye nodrag'}
            title={previewOn ? 'Hide preview' : 'Show preview'}
            onClick={(e) => {
              e.stopPropagation()
              togglePreview(id)
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </span>
      </div>

      <p className="schedule-hint nodrag">Local time · fires once per slot at start</p>

      <div className="seq-segment-list nodrag">
        {slots.map((slot, i) => (
          <div key={slot.id} className="seq-segment-row schedule-slot-row">
            <span className="seq-segment-idx">{i + 1}</span>
            <label className="seq-field">
              <span>Label</span>
              <input
                type="text"
                value={slot.label}
                onChange={(e) => updateSlot(i, { label: e.target.value })}
              />
            </label>
            <label className="seq-field narrow">
              <span>Time</span>
              <input
                type="time"
                value={slot.time}
                onChange={(e) => updateSlot(i, { time: e.target.value })}
              />
            </label>
            <div className="schedule-days">
              {WEEKDAY_LABELS.map((label, day) => (
                <button
                  key={label}
                  type="button"
                  className={
                    slot.days.length === 0 || slot.days.includes(day as Weekday)
                      ? 'schedule-day active'
                      : 'schedule-day'
                  }
                  title={slot.days.length === 0 ? 'Every day (no days selected = all)' : label}
                  onClick={() => toggleDay(i, day as Weekday)}
                >
                  {label[0]}
                </button>
              ))}
            </div>
            <button className="seq-remove" disabled={slots.length <= 1} onClick={() => removeSlot(i)}>
              ×
            </button>
          </div>
        ))}
        <button className="seq-add-segment" disabled={slots.length >= MAX_SCHEDULE_SLOTS} onClick={addSlot}>
          + Slot
        </button>
      </div>

      <div className="pf-node-ports">
        <div className="pf-ports-in" />
        <div className="pf-ports-out">
          {outputPorts.map((port) => (
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
          <NodePreview nodeId={id} nodeType={SCHEDULE_NODE_TYPE} kind="float" />
        </div>
      )}
    </div>
  )
}

export const ScheduleNode = memo(ScheduleNodeComponent)
