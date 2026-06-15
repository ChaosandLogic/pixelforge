import { useCallback, useEffect, useRef, useState } from 'react'
import { generateFixturePoints, type Fixture, type FixtureDef } from '@shared/patch/layout'
import type { PatchPoint } from '@shared/patch/types'
import { usePatchStore } from '@/store/patchStore'
import {
  applyHandleDrag,
  drawFixtureHandles,
  drawLineOverlay,
  drawRingOverlay,
  getFixtureHandles,
  hitTestHandle,
  type HandleKind
} from './fixtureHandles'
import {
  canvasCoords,
  createViewTransform,
  fixtureWorldBounds,
  fixturesInRect,
  hitTestFixture,
  normalizeRect,
  toScreen,
  toWorld,
  type ScreenRect,
  type ViewTransform
} from './layoutPreviewView'

const FIXTURE_COLORS = ['#4da3ff', '#ff6b4d', '#4dff91', '#c94dff', '#ffd24d', '#ff4da3']
const SELECTED_COLOR = '#ffffff'
const PATH_COLOR = 'rgba(140, 160, 190, 0.35)'
const MARQUEE_FILL = 'rgba(77, 163, 255, 0.12)'
const MARQUEE_STROKE = 'rgba(77, 163, 255, 0.85)'
const BG = '#0d1117'

interface LayoutPreviewProps {
  fixtures: Fixture[]
  points: PatchPoint[]
  selectedFixtureIds: string[]
  onSelectFixtures: (ids: string[]) => void
}

type InteractionMode = 'none' | 'marquee' | 'drag' | 'handle'

interface InteractionState {
  mode: InteractionMode
  startSx: number
  startSy: number
  lastWorldX: number
  lastWorldY: number
  dragIds: string[]
  handleKind: HandleKind | null
  handleFixtureId: string | null
  initialDef: FixtureDef | null
  /** Locked view transform for the duration of a drag (prevents auto-fit fighting the handle). */
  frozenView: ViewTransform | null
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  view: ViewTransform,
  fixtures: Fixture[],
  points: PatchPoint[],
  selectedIds: Set<string>,
  marquee: ScreenRect | null,
  primarySelected: Fixture | null
): void {
  const { width: w, height: h } = view
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, w, h)

  if (points.length === 0) {
    ctx.fillStyle = '#6b7a8f'
    ctx.font = '13px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText('No points', w / 2, h / 2)
    return
  }

  ctx.beginPath()
  ctx.strokeStyle = PATH_COLOR
  ctx.lineWidth = 1.5
  for (let i = 0; i < points.length; i++) {
    const p = points[i] as PatchPoint
    const { sx, sy } = toScreen(view, p.x, p.y)
    if (i === 0) ctx.moveTo(sx, sy)
    else ctx.lineTo(sx, sy)
  }
  ctx.stroke()

  let globalOffset = 0
  for (let fi = 0; fi < fixtures.length; fi++) {
    const fixture = fixtures[fi] as Fixture
    const fPoints = generateFixturePoints(fixture)
    const color = FIXTURE_COLORS[fi % FIXTURE_COLORS.length] as string
    const selected = selectedIds.has(fixture.id)

    for (let i = 0; i < fPoints.length; i++) {
      const idx = globalOffset + i
      if (idx >= points.length) break
      const p = points[idx] as PatchPoint
      const { sx, sy } = toScreen(view, p.x, p.y)
      const r = selected ? 5 : 3.5
      ctx.beginPath()
      ctx.fillStyle = selected ? SELECTED_COLOR : color
      ctx.arc(sx, sy, r, 0, Math.PI * 2)
      ctx.fill()

      if (i === 0) {
        ctx.fillStyle = '#e8edf5'
        ctx.font = '10px ui-monospace, monospace'
        ctx.textAlign = 'left'
        ctx.fillText('0', sx + 6, sy - 4)
      }
    }
    globalOffset += fPoints.length
  }

  if (primarySelected !== null) {
    const def = primarySelected.def
    if (def.kind === 'line') drawLineOverlay(ctx, view, def)
    if (def.kind === 'ring') drawRingOverlay(ctx, view, def)
    const bounds = fixtureWorldBounds(primarySelected)
    drawFixtureHandles(ctx, view, getFixtureHandles(primarySelected), bounds)
  }

  const first = points[0] as PatchPoint
  const start = toScreen(view, first.x, first.y)
  ctx.strokeStyle = '#4dff91'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(start.sx, start.sy, 8, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#4dff91'
  ctx.font = 'bold 10px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText('START', start.sx, start.sy - 12)

  if (marquee !== null && marquee.w > 2 && marquee.h > 2) {
    ctx.fillStyle = MARQUEE_FILL
    ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h)
    ctx.strokeStyle = MARQUEE_STROKE
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h)
    ctx.setLineDash([])
  }
}

export function LayoutPreview({
  fixtures,
  points,
  selectedFixtureIds,
  onSelectFixtures
}: LayoutPreviewProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const translateFixtures = usePatchStore((s) => s.translateFixtures)
  const updateFixture = usePatchStore((s) => s.updateFixture)
  const interactionRef = useRef<InteractionState>({
    mode: 'none',
    startSx: 0,
    startSy: 0,
    lastWorldX: 0,
    lastWorldY: 0,
    dragIds: [],
    handleKind: null,
    handleFixtureId: null,
    initialDef: null,
    frozenView: null
  })
  const selectedRef = useRef(selectedFixtureIds)
  const onSelectRef = useRef(onSelectFixtures)
  const fixturesRef = useRef(fixtures)
  const pointsRef = useRef(points)

  const [marquee, setMarquee] = useState<ScreenRect | null>(null)
  const [cursor, setCursor] = useState<string>('default')

  selectedRef.current = selectedFixtureIds
  onSelectRef.current = onSelectFixtures
  fixturesRef.current = fixtures
  pointsRef.current = points

  const primarySelected =
    selectedFixtureIds.length === 1
      ? (fixtures.find((f) => f.id === selectedFixtureIds[0]) ?? null)
      : null

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    const view = createViewTransform(points, canvas.width, canvas.height)
    drawScene(ctx, view, fixtures, points, new Set(selectedFixtureIds), marquee, primarySelected)
  }, [fixtures, points, selectedFixtureIds, marquee, primarySelected])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return

    const resize = (): void => {
      const { clientWidth, clientHeight } = canvas
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(clientWidth * dpr))
      canvas.height = Math.max(1, Math.floor(clientHeight * dpr))
      paint()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    return () => observer.disconnect()
  }, [paint])

  useEffect(() => {
    paint()
  }, [paint])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return

    const endInteraction = (): void => {
      interactionRef.current = {
        mode: 'none',
        startSx: 0,
        startSy: 0,
        lastWorldX: 0,
        lastWorldY: 0,
        dragIds: [],
        handleKind: null,
        handleFixtureId: null,
        initialDef: null,
        frozenView: null
      }
      setMarquee(null)
      setCursor('default')
    }

    const viewForCanvas = (frozen: ViewTransform | null): ViewTransform =>
      frozen ?? createViewTransform(pointsRef.current, canvas.width, canvas.height)

    const onPointerDown = (e: PointerEvent): void => {
      if (e.button !== 0) return
      canvas.setPointerCapture(e.pointerId)
      const { sx, sy } = canvasCoords(canvas, e.clientX, e.clientY)
      const view = createViewTransform(pointsRef.current, canvas.width, canvas.height)
      const { x: wx, y: wy } = toWorld(view, sx, sy)

      const selected = selectedRef.current
      if (selected.length === 1) {
        const fixture = fixturesRef.current.find((f) => f.id === selected[0])
        if (fixture !== undefined) {
          const handles = getFixtureHandles(fixture)
          const hit = hitTestHandle(view, handles, sx, sy)
          if (hit !== null) {
            interactionRef.current = {
              mode: 'handle',
              startSx: sx,
              startSy: sy,
              lastWorldX: wx,
              lastWorldY: wy,
              dragIds: [],
              handleKind: hit.kind,
              handleFixtureId: fixture.id,
              initialDef: structuredClone(fixture.def) as FixtureDef,
              frozenView: view
            }
            setCursor(hit.cursor)
            return
          }
        }
      }

      const hitId = hitTestFixture(view, fixturesRef.current, sx, sy)
      const selectedSet = new Set(selectedRef.current)

      if (hitId !== null) {
        let dragIds: string[]
        if (e.shiftKey) {
          const next = new Set(selectedRef.current)
          if (next.has(hitId)) next.delete(hitId)
          else next.add(hitId)
          dragIds = [...next]
          onSelectRef.current(dragIds)
        } else if (selectedSet.has(hitId)) {
          dragIds = [...selectedRef.current]
        } else {
          dragIds = [hitId]
          onSelectRef.current(dragIds)
        }

        interactionRef.current = {
          mode: 'drag',
          startSx: sx,
          startSy: sy,
          lastWorldX: wx,
          lastWorldY: wy,
          dragIds,
          handleKind: null,
          handleFixtureId: null,
          initialDef: null,
          frozenView: view
        }
        setCursor('grabbing')
        return
      }

      interactionRef.current = {
        mode: 'marquee',
        startSx: sx,
        startSy: sy,
        lastWorldX: wx,
        lastWorldY: wy,
        dragIds: [],
        handleKind: null,
        handleFixtureId: null,
        initialDef: null,
        frozenView: view
      }
      setMarquee(normalizeRect(sx, sy, sx, sy))
      setCursor('crosshair')
      if (!e.shiftKey) onSelectRef.current([])
    }

    const onPointerMove = (e: PointerEvent): void => {
      const state = interactionRef.current
      const { sx, sy } = canvasCoords(canvas, e.clientX, e.clientY)
      const view = viewForCanvas(state.frozenView)

      if (state.mode === 'marquee') {
        setMarquee(normalizeRect(state.startSx, state.startSy, sx, sy))
        return
      }

      if (state.mode === 'handle' && state.handleKind !== null && state.handleFixtureId !== null && state.initialDef !== null) {
        const { x, y } = toWorld(view, sx, sy)
        const def = applyHandleDrag(state.initialDef, state.handleKind, { x, y, z: 0 })
        updateFixture(state.handleFixtureId, { def })
        return
      }

      if (state.mode === 'drag') {
        const { x: worldX, y: worldY } = toWorld(view, sx, sy)
        const dx = worldX - state.lastWorldX
        const dy = worldY - state.lastWorldY
        if (dx !== 0 || dy !== 0) {
          translateFixtures(state.dragIds, { x: dx, y: dy, z: 0 })
          state.lastWorldX = worldX
          state.lastWorldY = worldY
        }
        return
      }

      const hoverView = createViewTransform(pointsRef.current, canvas.width, canvas.height)
      if (selectedRef.current.length === 1) {
        const fixture = fixturesRef.current.find((f) => f.id === selectedRef.current[0])
        if (fixture !== undefined) {
          const hit = hitTestHandle(hoverView, getFixtureHandles(fixture), sx, sy)
          if (hit !== null) {
            setCursor(hit.cursor)
            return
          }
        }
      }

      const hitId = hitTestFixture(hoverView, fixturesRef.current, sx, sy)
      setCursor(hitId !== null ? 'grab' : 'default')
    }

    const onPointerUp = (e: PointerEvent): void => {
      const state = interactionRef.current
      const { sx, sy } = canvasCoords(canvas, e.clientX, e.clientY)

      if (state.mode === 'marquee') {
        const view = viewForCanvas(state.frozenView)
        const rect = normalizeRect(state.startSx, state.startSy, sx, sy)
        if (rect.w > 4 || rect.h > 4) {
          const ids = fixturesInRect(view, fixturesRef.current, rect)
          if (e.shiftKey) {
            const merged = new Set(selectedRef.current)
            for (const id of ids) merged.add(id)
            onSelectRef.current([...merged])
          } else {
            onSelectRef.current(ids)
          }
        }
      }

      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId)
      }
      endInteraction()
    }

    const onPointerLeave = (): void => {
      if (interactionRef.current.mode === 'none') setCursor('default')
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerLeave)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [translateFixtures, updateFixture])

  return (
    <div className="layout-preview-wrap">
      <canvas ref={canvasRef} className="layout-preview-canvas" style={{ cursor }} />
      <p className="layout-preview-hint">
        Drag body to move · handles to resize · marquee to select · Shift to add
      </p>
    </div>
  )
}
