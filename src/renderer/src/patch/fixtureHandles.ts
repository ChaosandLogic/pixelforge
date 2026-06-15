import type { Fixture, FixtureDef, Vec3 } from '@shared/patch/layout'
import { matrixSpacing } from '@shared/patch/layout'
import type { ViewTransform } from './layoutPreviewView'

export type HandleKind =
  | 'line-start'
  | 'line-end'
  | 'matrix-scale'
  | 'matrix-width'
  | 'matrix-height'
  | 'ring-radius'

export interface FixtureHandle {
  id: string
  kind: HandleKind
  wx: number
  wy: number
  cursor: string
}

const HANDLE_HIT_PX = 12

export function getFixtureHandles(fixture: Fixture): FixtureHandle[] {
  const def = fixture.def
  switch (def.kind) {
    case 'line':
      return [
        { id: 'line-start', kind: 'line-start', wx: def.start.x, wy: def.start.y, cursor: 'crosshair' },
        { id: 'line-end', kind: 'line-end', wx: def.end.x, wy: def.end.y, cursor: 'crosshair' }
      ]
    case 'matrix': {
      const colCount = Math.max(1, Math.floor(def.cols))
      const rowCount = Math.max(1, Math.floor(def.rows))
      const { spacingX, spacingY } = matrixSpacing(def)
      const minX = def.origin.x
      const minY = def.origin.y
      const maxX = def.origin.x + (colCount - 1) * spacingX
      const maxY = def.origin.y + (rowCount - 1) * spacingY
      const midX = (minX + maxX) / 2
      const midY = (minY + maxY) / 2
      return [
        { id: 'matrix-scale', kind: 'matrix-scale', wx: maxX, wy: maxY, cursor: 'nwse-resize' },
        { id: 'matrix-width', kind: 'matrix-width', wx: maxX, wy: midY, cursor: 'ew-resize' },
        { id: 'matrix-height', kind: 'matrix-height', wx: midX, wy: maxY, cursor: 'ns-resize' }
      ]
    }
    case 'ring': {
      const angle = def.startAngle
      return [
        {
          id: 'ring-radius',
          kind: 'ring-radius',
          wx: def.center.x + def.radius * Math.cos(angle),
          wy: def.center.y + def.radius * Math.sin(angle),
          cursor: 'ew-resize'
        }
      ]
    }
  }
}

export function hitTestHandle(
  view: ViewTransform,
  handles: FixtureHandle[],
  sx: number,
  sy: number
): FixtureHandle | null {
  const r = HANDLE_HIT_PX
  for (let i = handles.length - 1; i >= 0; i--) {
    const h = handles[i] as FixtureHandle
    const hs = {
      sx: view.margin + (h.wx - view.bounds.minX) * view.scale,
      sy: view.margin + (h.wy - view.bounds.minY) * view.scale
    }
    const dx = sx - hs.sx
    const dy = sy - hs.sy
    if (dx * dx + dy * dy <= r * r) return h
  }
  return null
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay)
}

/** Apply a handle drag from the snapshot def taken at pointer-down. */
export function applyHandleDrag(initial: FixtureDef, kind: HandleKind, world: Vec3): FixtureDef {
  switch (initial.kind) {
    case 'line':
      switch (kind) {
        case 'line-start':
          return { ...initial, start: { ...initial.start, x: world.x, y: world.y } }
        case 'line-end':
          return { ...initial, end: { ...initial.end, x: world.x, y: world.y } }
        default:
          return initial
      }
    case 'matrix': {
      const { origin, cols, rows } = initial
      const colCount = Math.max(1, Math.floor(cols))
      const rowCount = Math.max(1, Math.floor(rows))
      const current = matrixSpacing(initial)
      let spacingX = current.spacingX
      let spacingY = current.spacingY

      if (kind === 'matrix-width' && colCount > 1) {
        spacingX = Math.max(0.001, (world.x - origin.x) / (colCount - 1))
      } else if (kind === 'matrix-height' && rowCount > 1) {
        spacingY = Math.max(0.001, (world.y - origin.y) / (rowCount - 1))
      } else if (kind === 'matrix-scale') {
        if (colCount > 1) spacingX = Math.max(0.001, (world.x - origin.x) / (colCount - 1))
        if (rowCount > 1) spacingY = Math.max(0.001, (world.y - origin.y) / (rowCount - 1))
      }
      return { ...initial, spacingX, spacingY }
    }
    case 'ring':
      if (kind === 'ring-radius') {
        const r = dist(initial.center.x, initial.center.y, world.x, world.y)
        return { ...initial, radius: Math.max(0.01, r) }
      }
      return initial
    default:
      return initial
  }
}

export function drawFixtureHandles(
  ctx: CanvasRenderingContext2D,
  view: ViewTransform,
  handles: FixtureHandle[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null
): void {
  if (bounds !== null) {
    const tl = {
      sx: view.margin + (bounds.minX - view.bounds.minX) * view.scale,
      sy: view.margin + (bounds.minY - view.bounds.minY) * view.scale
    }
    const br = {
      sx: view.margin + (bounds.maxX - view.bounds.minX) * view.scale,
      sy: view.margin + (bounds.maxY - view.bounds.minY) * view.scale
    }
    const x = Math.min(tl.sx, br.sx)
    const y = Math.min(tl.sy, br.sy)
    const w = Math.abs(br.sx - tl.sx)
    const h = Math.abs(br.sy - tl.sy)
    ctx.strokeStyle = 'rgba(77, 163, 255, 0.65)'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 4])
    ctx.strokeRect(x, y, w, h)
    ctx.setLineDash([])
  }

  for (const h of handles) {
    const sx = view.margin + (h.wx - view.bounds.minX) * view.scale
    const sy = view.margin + (h.wy - view.bounds.minY) * view.scale
    ctx.beginPath()
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#4da3ff'
    ctx.lineWidth = 2
    ctx.arc(sx, sy, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}

/** Draw line between endpoints when a line fixture is selected. */
export function drawLineOverlay(
  ctx: CanvasRenderingContext2D,
  view: ViewTransform,
  def: Extract<FixtureDef, { kind: 'line' }>
): void {
  const a = {
    sx: view.margin + (def.start.x - view.bounds.minX) * view.scale,
    sy: view.margin + (def.start.y - view.bounds.minY) * view.scale
  }
  const b = {
    sx: view.margin + (def.end.x - view.bounds.minX) * view.scale,
    sy: view.margin + (def.end.y - view.bounds.minY) * view.scale
  }
  ctx.strokeStyle = 'rgba(77, 163, 255, 0.55)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(a.sx, a.sy)
  ctx.lineTo(b.sx, b.sy)
  ctx.stroke()
}

/** Draw ring outline when a ring fixture is selected. */
export function drawRingOverlay(
  ctx: CanvasRenderingContext2D,
  view: ViewTransform,
  def: Extract<FixtureDef, { kind: 'ring' }>
): void {
  const c = {
    sx: view.margin + (def.center.x - view.bounds.minX) * view.scale,
    sy: view.margin + (def.center.y - view.bounds.minY) * view.scale
  }
  const r = def.radius * view.scale
  ctx.strokeStyle = 'rgba(77, 163, 255, 0.55)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(c.sx, c.sy, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(c.sx, c.sy)
  ctx.lineTo(
    view.margin + (def.center.x + def.radius * Math.cos(def.startAngle) - view.bounds.minX) * view.scale,
    view.margin + (def.center.y + def.radius * Math.sin(def.startAngle) - view.bounds.minY) * view.scale
  )
  ctx.stroke()
  ctx.setLineDash([])
}
