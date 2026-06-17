import { memo, useEffect, useRef } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeType } from '@shared/graph/registry'
import type { PfNode as PfNodeType } from '@/store/graphStore'
import { getLocalKeyboardState } from '@/media/KeyboardManager'
import { NodeProfilerBadge } from './NodeProfilerBadge'

const TRIGGER_FLASH_MS = 350

function KeyboardInNodeComponent({ id, data, selected }: NodeProps<PfNodeType>): React.JSX.Element {
  const previewRef = useRef<HTMLCanvasElement>(null)
  const def = getNodeType(data.nodeType)

  useEffect(() => {
    const canvas = previewRef.current
    if (canvas === null) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    let raf = 0

    const draw = (): void => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const state = getLocalKeyboardState(id)
      const gate = state?.gate ?? 0
      const flash =
        state !== null && performance.now() - state.triggerAt < TRIGGER_FLASH_MS
      const flashT =
        state !== null
          ? Math.max(0, 1 - (performance.now() - state.triggerAt) / TRIGGER_FLASH_MS)
          : 0

      ctx.fillStyle = '#0a0d12'
      ctx.fillRect(0, 0, w, h)

      const pad = 8
      const dotR = 5
      const dotX = pad + dotR
      const dotY = h / 2

      ctx.beginPath()
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
      ctx.fillStyle = flash
        ? `rgba(255, 180, 60, ${0.35 + flashT * 0.65})`
        : gate > 0
          ? 'rgba(80, 200, 120, 0.85)'
          : 'rgba(80, 90, 110, 0.45)'
      ctx.fill()

      if (flash) {
        ctx.beginPath()
        ctx.arc(dotX, dotY, dotR + 3 + flashT * 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 180, 60, ${flashT * 0.7})`
        ctx.lineWidth = 2
        ctx.stroke()
      }

      const barX = pad * 2 + dotR * 2
      const barW = w - barX - pad
      const barH = 10
      const barY = (h - barH) / 2

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.fillRect(barX, barY, barW, barH)

      if (gate > 0) {
        ctx.fillStyle = flash ? 'rgba(255, 180, 60, 0.85)' : 'rgba(80, 160, 255, 0.75)'
        ctx.fillRect(barX, barY, barW * gate, barH)
      }

      ctx.fillStyle = flash ? '#ffd24d' : gate > 0 ? '#9ec5ff' : '#6b7a8f'
      ctx.font = '10px ui-monospace, monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(flash ? 'TRIG' : gate > 0 ? 'HOLD' : '—', w - pad, h / 2)

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [id])

  if (def === undefined) {
    return <div className="pf-node error">Unknown: {data.nodeType}</div>
  }

  return (
    <div className={selected ? 'pf-node selected' : 'pf-node'} data-category="time">
      <div className="pf-node-header">
        <span className="pf-node-title">{def.label}</span>
        <span className="pf-node-header-right">
          <NodeProfilerBadge nodeId={id} />
        </span>
      </div>

      <canvas ref={previewRef} className="keyboard-preview" height={28} />

      <div className="pf-node-ports">
        <div className="pf-ports-in" />
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

export const KeyboardInNode = memo(KeyboardInNodeComponent)
