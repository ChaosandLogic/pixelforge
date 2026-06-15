import { memo, useEffect, useRef, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeType } from '@shared/graph/registry'
import { useGraphStore, type PfNode as PfNodeType } from '@/store/graphStore'
import {
  getAudioInputDevices,
  getLocalAudioState,
  refreshAudioInputDevices
} from '@/media/AudioManager'
import { NodeProfilerBadge } from './NodeProfilerBadge'

function basename(path: string): string {
  if (path === '') return 'Choose file…'
  return path.split('/').pop() ?? path
}

function AudioInNodeComponent({ id, data, selected }: NodeProps<PfNodeType>): React.JSX.Element {
  const updateParam = useGraphStore((s) => s.updateParam)
  const def = getNodeType(data.nodeType)
  const source = data.params['source'] === 'file' ? 'file' : 'device'
  const deviceId = typeof data.params['device'] === 'string' ? data.params['device'] : ''
  const filePath = typeof data.params['file'] === 'string' ? data.params['file'] : ''
  const monitor = data.params['monitor'] !== false
  const lowMax = typeof data.params['lowMax'] === 'number' ? data.params['lowMax'] : 250
  const midMax = typeof data.params['midMax'] === 'number' ? data.params['midMax'] : 4000

  const spectrumRef = useRef<HTMLCanvasElement>(null)
  const meterRefs = useRef<Record<'low' | 'mid' | 'high', HTMLDivElement | null>>({
    low: null,
    mid: null,
    high: null
  })
  const meterValueRefs = useRef<Record<'low' | 'mid' | 'high', HTMLSpanElement | null>>({
    low: null,
    mid: null,
    high: null
  })
  const [devices, setDevices] = useState<MediaDeviceInfo[]>(() => getAudioInputDevices())

  useEffect(() => {
    void refreshAudioInputDevices().then(setDevices)
  }, [source])

  useEffect(() => {
    const canvas = spectrumRef.current
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
      ctx.fillStyle = '#0a0d12'
      ctx.fillRect(0, 0, w, h)

      const state = getLocalAudioState(id)
      if (state !== null && state.spectrum.length > 0) {
        const nyquist = state.sampleRate / 2
        const barW = w / state.spectrum.length
        for (let i = 0; i < state.spectrum.length; i++) {
          const db = state.spectrum[i] ?? -100
          const amp = db <= -100 ? 0 : Math.min(1, Math.pow(10, db / 20))
          const barH = amp * h
          ctx.fillStyle = 'rgba(255, 120, 60, 0.75)'
          ctx.fillRect(i * barW, h - barH, Math.max(1, barW), barH)
        }

        const xLow = (state.lowMax / nyquist) * w
        const xMid = (state.midMax / nyquist) * w
        ctx.strokeStyle = 'rgba(255, 210, 77, 0.9)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(xLow, 0)
        ctx.lineTo(xLow, h)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(80, 160, 255, 0.9)'
        ctx.beginPath()
        ctx.moveTo(xMid, 0)
        ctx.lineTo(xMid, h)
        ctx.stroke()
      } else {
        ctx.fillStyle = '#556'
        ctx.font = '10px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.fillText(state?.error ?? 'No signal', w / 2, h / 2)
      }

      if (state !== null) {
        for (const band of ['low', 'mid', 'high'] as const) {
          const fill = meterRefs.current[band]
          const label = meterValueRefs.current[band]
          const v = state.levels[band]
          if (fill !== null) fill.style.width = `${Math.round(v * 100)}%`
          if (label !== null) label.textContent = v.toFixed(2)
        }
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [id, lowMax, midMax])

  if (def === undefined) {
    return <div className="pf-node error">Unknown: {data.nodeType}</div>
  }

  const levels = getLocalAudioState(id)?.levels ?? { low: 0, mid: 0, high: 0 }

  return (
    <div className={selected ? 'pf-node pf-audio selected' : 'pf-node pf-audio'} data-category="audio">
      <div className="pf-node-header">
        <span className="pf-node-title">{def.label}</span>
        <span className="pf-node-header-right">
          <NodeProfilerBadge nodeId={id} />
        </span>
      </div>

      <div className="audio-controls nodrag">
        <label className="audio-field">
          <span>Source</span>
          <select
            value={source}
            onChange={(e) => updateParam(id, 'source', e.target.value)}
          >
            <option value="device">Device</option>
            <option value="file">File</option>
          </select>
        </label>

        {source === 'device' ? (
          <label className="audio-field wide">
            <span>Input</span>
            <select value={deviceId} onChange={(e) => updateParam(id, 'device', e.target.value)}>
              <option value="">Default input</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Input ${d.deviceId.slice(0, 8)}…`}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <button
              className="audio-file-btn"
              title={filePath}
              onClick={() => {
                void window.pixelforge.pickAudioFile().then((picked) => {
                  if (picked !== null) updateParam(id, 'file', picked)
                })
              }}
            >
              {basename(filePath)}
            </button>
            <label className="audio-monitor">
              <input
                type="checkbox"
                checked={monitor}
                onChange={(e) => updateParam(id, 'monitor', e.target.checked)}
              />
              Monitor
            </label>
          </>
        )}
      </div>

      <canvas ref={spectrumRef} className="audio-spectrum" width={280} height={48} />

      <div className="audio-meters nodrag">
        {(['low', 'mid', 'high'] as const).map((band) => (
          <div key={band} className="audio-meter">
            <span className="audio-meter-label">{band}</span>
            <div className="audio-meter-track">
              <div
                ref={(el) => {
                  meterRefs.current[band] = el
                }}
                className={`audio-meter-fill audio-meter-${band}`}
                style={{ width: `${Math.round(levels[band] * 100)}%` }}
              />
            </div>
            <span
              ref={(el) => {
                meterValueRefs.current[band] = el
              }}
              className="audio-meter-value"
            >
              {levels[band].toFixed(2)}
            </span>
          </div>
        ))}
      </div>

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

export const AudioInNode = memo(AudioInNodeComponent)
