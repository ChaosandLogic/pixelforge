import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MAX_GRADIENT_STOPS,
  sampleGradientStopsRgb,
  type GradientStop
} from '@shared/colour/gradientStops'
import { hexToRgb, rgbToHex } from '@/lib/colour'

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function sortStops(stops: GradientStop[]): GradientStop[] {
  return [...stops].sort((a, b) => a.position - b.position)
}

interface GradientEditorProps {
  stops: GradientStop[]
  onChange: (stops: GradientStop[]) => void
}

export function GradientEditor({ stops, onChange }: GradientEditorProps): React.JSX.Element {
  const barRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sorted = useMemo(() => sortStops(stops), [stops])
  const selected = sorted.find((s) => s.id === selectedId) ?? sorted[0] ?? null

  const cssGradient = useMemo(() => {
    if (sorted.length === 0) return 'linear-gradient(to right, #000, #fff)'
    const parts = sorted.map((s) => {
      const c = s.colour
      return `rgb(${c.r}, ${c.g}, ${c.b}) ${s.position * 100}%`
    })
    return `linear-gradient(to right, ${parts.join(', ')})`
  }, [sorted])

  const commit = useCallback(
    (next: GradientStop[]) => {
      onChange(sortStops(next))
    },
    [onChange]
  )

  const positionFromClientX = useCallback((clientX: number): number => {
    const bar = barRef.current
    if (bar === null) return 0
    const rect = bar.getBoundingClientRect()
    if (rect.width <= 0) return 0
    return clamp01((clientX - rect.left) / rect.width)
  }, [])

  const addStopAt = useCallback(
    (clientX: number) => {
      if (stops.length >= MAX_GRADIENT_STOPS) return
      const position = positionFromClientX(clientX)
      const colour = sampleGradientStopsRgb(stops, position)
      const id = `g${Date.now()}`
      commit([...stops, { id, position, colour }])
      setSelectedId(id)
    },
    [commit, positionFromClientX, stops]
  )

  const onBarPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).closest('.grad-stop-handle')) return
    if (e.button !== 0) return
    addStopAt(e.clientX)
  }

  const onHandlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, id: string): void => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(id)
    dragRef.current = { id, pointerId: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onHandlePointerMove = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current
    if (drag === null || drag.pointerId !== e.pointerId) return
    const position = positionFromClientX(e.clientX)
    commit(stops.map((s) => (s.id === drag.id ? { ...s, position } : s)))
  }

  const onHandlePointerUp = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current
    if (drag === null || drag.pointerId !== e.pointerId) return
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const removeSelected = (): void => {
    if (selected === null || stops.length <= 2) return
    const next = stops.filter((s) => s.id !== selected.id)
    commit(next)
    setSelectedId(next[0]?.id ?? null)
  }

  useEffect(() => {
    if (selectedId !== null && stops.some((s) => s.id === selectedId)) return
    setSelectedId(sorted[0]?.id ?? null)
  }, [selectedId, sorted, stops])

  return (
    <div className="gradient-editor">
      <div
        ref={barRef}
        className="gradient-bar"
        style={{ background: cssGradient }}
        onPointerDown={onBarPointerDown}
        title="Click to add a colour stop"
      >
        {sorted.map((stop) => (
          <button
            key={stop.id}
            type="button"
            className={`grad-stop-handle${selected?.id === stop.id ? ' selected' : ''}`}
            style={{
              left: `${stop.position * 100}%`,
              background: rgbToHex(stop.colour)
            }}
            title={`Stop at ${(stop.position * 100).toFixed(0)}%`}
            onPointerDown={(e) => onHandlePointerDown(e, stop.id)}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
          />
        ))}
      </div>
      <p className="gradient-hint">Click the bar to add stops · drag to reposition</p>
      {selected !== null && (
        <div className="gradient-stop-controls">
          <label className="gradient-colour-label">
            <span>Colour</span>
            <input
              type="color"
              value={rgbToHex(selected.colour)}
              onChange={(e) => {
                const colour = hexToRgb(e.target.value)
                commit(stops.map((s) => (s.id === selected.id ? { ...s, colour } : s)))
              }}
            />
          </label>
          <span className="gradient-stop-pos">{(selected.position * 100).toFixed(0)}%</span>
          <button
            type="button"
            className="gradient-remove-stop"
            disabled={stops.length <= 2}
            onClick={removeSelected}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
