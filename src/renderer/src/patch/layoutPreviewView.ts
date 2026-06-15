import { generateFixturePoints, type Fixture } from '@shared/patch/layout'
import type { PatchPoint } from '@shared/patch/types'

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ScreenRect {
  x: number
  y: number
  w: number
  h: number
}

export interface ViewTransform {
  bounds: Bounds
  scale: number
  margin: number
  width: number
  height: number
}

export function computeBounds(points: PatchPoint[]): Bounds {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const padX = Math.max(0.1, (maxX - minX) * 0.1)
  const padY = Math.max(0.1, (maxY - minY) * 0.1)
  return { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY }
}

export function createViewTransform(points: PatchPoint[], width: number, height: number): ViewTransform {
  const bounds = computeBounds(points)
  const rangeX = bounds.maxX - bounds.minX || 1
  const rangeY = bounds.maxY - bounds.minY || 1
  const margin = 24
  const scale = Math.min((width - margin * 2) / rangeX, (height - margin * 2) / rangeY)
  return { bounds, scale, margin, width, height }
}

export function toScreen(view: ViewTransform, x: number, y: number): { sx: number; sy: number } {
  return {
    sx: view.margin + (x - view.bounds.minX) * view.scale,
    sy: view.margin + (y - view.bounds.minY) * view.scale
  }
}

export function toWorld(view: ViewTransform, sx: number, sy: number): { x: number; y: number } {
  return {
    x: view.bounds.minX + (sx - view.margin) / view.scale,
    y: view.bounds.minY + (sy - view.margin) / view.scale
  }
}

export function fixtureWorldBounds(fixture: Fixture): Bounds {
  const pts = generateFixturePoints(fixture)
  if (pts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

export function fixtureScreenBounds(view: ViewTransform, fixture: Fixture, pad = 8): ScreenRect {
  const b = fixtureWorldBounds(fixture)
  const tl = toScreen(view, b.minX, b.minY)
  const br = toScreen(view, b.maxX, b.maxY)
  const x = Math.min(tl.sx, br.sx) - pad
  const y = Math.min(tl.sy, br.sy) - pad
  const w = Math.abs(br.sx - tl.sx) + pad * 2
  const h = Math.abs(br.sy - tl.sy) + pad * 2
  return { x, y, w, h }
}

function pointInRect(px: number, py: number, r: ScreenRect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

function rectsOverlap(a: ScreenRect, b: ScreenRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** Topmost fixture under screen coords (later fixtures drawn on top). */
export function hitTestFixture(view: ViewTransform, fixtures: Fixture[], sx: number, sy: number): string | null {
  for (let i = fixtures.length - 1; i >= 0; i--) {
    const fixture = fixtures[i] as Fixture
    if (pointInRect(sx, sy, fixtureScreenBounds(view, fixture))) return fixture.id
  }
  return null
}

export function fixturesInRect(view: ViewTransform, fixtures: Fixture[], rect: ScreenRect): string[] {
  const ids: string[] = []
  for (const fixture of fixtures) {
    if (rectsOverlap(fixtureScreenBounds(view, fixture), rect)) ids.push(fixture.id)
  }
  return ids
}

export function normalizeRect(x0: number, y0: number, x1: number, y1: number): ScreenRect {
  const x = Math.min(x0, x1)
  const y = Math.min(y0, y1)
  return { x, y, w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }
}

export function canvasCoords(canvas: HTMLCanvasElement, clientX: number, clientY: number): { sx: number; sy: number } {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    sx: (clientX - rect.left) * scaleX,
    sy: (clientY - rect.top) * scaleY
  }
}
