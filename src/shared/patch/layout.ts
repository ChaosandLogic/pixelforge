import { MAX_PIXELS } from '../messages'
import type { PatchPoint } from './types'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export type StartCorner = 'tl' | 'tr' | 'bl' | 'br'
export type MatrixOrientation = 'rows' | 'cols'
export type FixtureKind = 'line' | 'matrix' | 'ring'

export type FixtureDef =
  | { kind: 'line'; count: number; start: Vec3; end: Vec3; reversed?: boolean }
  | {
      kind: 'matrix'
      cols: number
      rows: number
      spacingX: number
      spacingY: number
      origin: Vec3
      serpentine: boolean
      startCorner: StartCorner
      orientation: MatrixOrientation
    }
  | { kind: 'ring'; count: number; radius: number; center: Vec3; startAngle: number; clockwise: boolean }

export interface Fixture {
  id: string
  name: string
  def: FixtureDef
}

export interface LayoutData {
  fixtures: Fixture[]
}

/** Pixel index range for one fixture in the flat patch stream. */
export interface FixtureRange {
  id: string
  name: string
  start: number
  count: number
  /** Logical width for previews / stream rasterisation. */
  width: number
  /** Logical height for previews / stream rasterisation. */
  height: number
}

/** Logical W×H of a fixture's pixel stream. */
export function fixtureStreamResolution(def: FixtureDef): { width: number; height: number } {
  switch (def.kind) {
    case 'matrix':
      return {
        width: Math.max(1, Math.floor(def.cols)),
        height: Math.max(1, Math.floor(def.rows))
      }
    case 'line':
      return { width: Math.max(1, Math.floor(def.count)), height: 1 }
    case 'ring':
      return { width: Math.max(1, Math.floor(def.count)), height: 1 }
  }
}

/** Map layout fixtures to contiguous index ranges in patch order. */
export function fixtureRanges(layout: LayoutData): FixtureRange[] {
  const ranges: FixtureRange[] = []
  let start = 0
  for (const fixture of layout.fixtures) {
    const count = fixturePointCount(fixture.def)
    const { width, height } = fixtureStreamResolution(fixture.def)
    ranges.push({ id: fixture.id, name: fixture.name, start, count, width, height })
    start += count
  }
  return ranges
}

export interface BuildLayoutResult {
  points: PatchPoint[]
  /** True when the layout would exceed MAX_PIXELS and was truncated. */
  overflow: boolean
  /** Total points before clamping. */
  totalBeforeClamp: number
}

let fixtureCounter = 0

export function nextFixtureId(): string {
  fixtureCounter += 1
  return `fixture-${fixtureCounter}`
}

/** Reset the id counter (tests / deterministic defaults). */
export function resetFixtureIdCounter(value = 0): void {
  fixtureCounter = value
}

export function defaultFixtureDef(kind: FixtureKind): FixtureDef {
  switch (kind) {
    case 'line':
      return { kind: 'line', count: 50, start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } }
    case 'matrix':
      return {
        kind: 'matrix',
        cols: 16,
        rows: 8,
        spacingX: 1,
        spacingY: 1,
        origin: { x: 0, y: 0, z: 0 },
        serpentine: true,
        startCorner: 'bl',
        orientation: 'rows'
      }
    case 'ring':
      return {
        kind: 'ring',
        count: 60,
        radius: 1,
        center: { x: 0, y: 0, z: 0 },
        startAngle: 0,
        clockwise: true
      }
  }
}

export function defaultFixtureName(kind: FixtureKind): string {
  switch (kind) {
    case 'line':
      return 'Line'
    case 'matrix':
      return 'Matrix'
    case 'ring':
      return 'Ring'
  }
}

export function createFixture(kind: FixtureKind, name?: string): Fixture {
  return { id: nextFixtureId(), name: name ?? defaultFixtureName(kind), def: defaultFixtureDef(kind) }
}

export function createDefaultLayout(): LayoutData {
  resetFixtureIdCounter(0)
  const fixture = createFixture('line', 'Main line')
  if (fixture.def.kind === 'line') {
    fixture.def.count = 170
    fixture.def.start = { x: 0, y: 0, z: 0 }
    fixture.def.end = { x: 1, y: 0, z: 0 }
  }
  return { fixtures: [fixture] }
}

/** Point count for a single fixture definition. */
export function fixturePointCount(def: FixtureDef): number {
  switch (def.kind) {
    case 'line':
      return Math.max(1, Math.floor(def.count))
    case 'matrix':
      return Math.max(1, Math.floor(def.cols)) * Math.max(1, Math.floor(def.rows))
    case 'ring':
      return Math.max(1, Math.floor(def.count))
  }
}

export function generateLinePoints(def: Extract<FixtureDef, { kind: 'line' }>, idPrefix: string): PatchPoint[] {
  const count = Math.max(1, Math.floor(def.count))
  const points: PatchPoint[] = []
  const denom = Math.max(1, count - 1)
  for (let i = 0; i < count; i++) {
    const idx = def.reversed === true ? count - 1 - i : i
    const t = idx / denom
    points.push({
      id: `${idPrefix}:${i}`,
      x: def.start.x + (def.end.x - def.start.x) * t,
      y: def.start.y + (def.end.y - def.start.y) * t,
      z: def.start.z + (def.end.z - def.start.z) * t
    })
  }
  return points
}

/** Matrix cell (col, row) in wiring order. */
function matrixWiringOrder(def: Extract<FixtureDef, { kind: 'matrix' }>): Array<{ col: number; row: number }> {
  const cols = Math.max(1, Math.floor(def.cols))
  const rows = Math.max(1, Math.floor(def.rows))
  const order: Array<{ col: number; row: number }> = []

  if (def.orientation === 'rows') {
    const startFromTop = def.startCorner === 'tl' || def.startCorner === 'tr'
    const startFromLeft = def.startCorner === 'tl' || def.startCorner === 'bl'
    for (let r = 0; r < rows; r++) {
      const row = startFromTop ? r : rows - 1 - r
      const leftToRight = startFromLeft ? (def.serpentine ? r % 2 === 0 : true) : def.serpentine ? r % 2 === 0 : false
      if (leftToRight) {
        for (let c = 0; c < cols; c++) order.push({ col: c, row })
      } else {
        for (let c = cols - 1; c >= 0; c--) order.push({ col: c, row })
      }
    }
  } else {
    const startFromLeft = def.startCorner === 'tl' || def.startCorner === 'bl'
    const startFromTop = def.startCorner === 'tl' || def.startCorner === 'tr'
    for (let c = 0; c < cols; c++) {
      const col = startFromLeft ? c : cols - 1 - c
      const topToBottom = startFromTop ? (def.serpentine ? c % 2 === 0 : true) : def.serpentine ? c % 2 === 0 : false
      if (topToBottom) {
        for (let r = 0; r < rows; r++) order.push({ col, row: r })
      } else {
        for (let r = rows - 1; r >= 0; r--) order.push({ col, row: r })
      }
    }
  }
  return order
}

/** Read matrix spacing, accepting legacy `spacing` from saved projects. */
export function matrixSpacing(def: Extract<FixtureDef, { kind: 'matrix' }>): { spacingX: number; spacingY: number } {
  const legacy = (def as { spacing?: number }).spacing
  const spacingX = typeof def.spacingX === 'number' ? def.spacingX : (legacy ?? 1)
  const spacingY = typeof def.spacingY === 'number' ? def.spacingY : (legacy ?? 1)
  return { spacingX, spacingY }
}

export function generateMatrixPoints(def: Extract<FixtureDef, { kind: 'matrix' }>, idPrefix: string): PatchPoint[] {
  const { spacingX, spacingY } = matrixSpacing(def)
  const order = matrixWiringOrder(def)
  const points: PatchPoint[] = []

  for (let i = 0; i < order.length; i++) {
    const { col, row } = order[i] as { col: number; row: number }
    points.push({
      id: `${idPrefix}:${i}`,
      x: def.origin.x + col * spacingX,
      y: def.origin.y + row * spacingY,
      z: def.origin.z
    })
  }
  return points
}

export function generateRingPoints(def: Extract<FixtureDef, { kind: 'ring' }>, idPrefix: string): PatchPoint[] {
  const count = Math.max(1, Math.floor(def.count))
  const points: PatchPoint[] = []
  const dir = def.clockwise ? -1 : 1
  for (let i = 0; i < count; i++) {
    const angle = def.startAngle + dir * ((2 * Math.PI * i) / count)
    points.push({
      id: `${idPrefix}:${i}`,
      x: def.center.x + def.radius * Math.cos(angle),
      y: def.center.y + def.radius * Math.sin(angle),
      z: def.center.z
    })
  }
  return points
}

export function generateFixturePoints(fixture: Fixture): PatchPoint[] {
  const prefix = fixture.id
  switch (fixture.def.kind) {
    case 'line':
      return generateLinePoints(fixture.def, prefix)
    case 'matrix':
      return generateMatrixPoints(fixture.def, prefix)
    case 'ring':
      return generateRingPoints(fixture.def, prefix)
  }
}

/** Translate a fixture definition by a world-space offset (XY layout editing). */
export function translateFixtureDef(def: FixtureDef, delta: Vec3): FixtureDef {
  switch (def.kind) {
    case 'line':
      return {
        ...def,
        start: { x: def.start.x + delta.x, y: def.start.y + delta.y, z: def.start.z + delta.z },
        end: { x: def.end.x + delta.x, y: def.end.y + delta.y, z: def.end.z + delta.z }
      }
    case 'matrix':
      return {
        ...def,
        origin: { x: def.origin.x + delta.x, y: def.origin.y + delta.y, z: def.origin.z + delta.z }
      }
    case 'ring':
      return {
        ...def,
        center: { x: def.center.x + delta.x, y: def.center.y + delta.y, z: def.center.z + delta.z }
      }
  }
}

/** Concatenate all fixtures in order; clamp to MAX_PIXELS. */
export function buildLayoutPoints(layout: LayoutData): BuildLayoutResult {
  const all: PatchPoint[] = []
  for (const fixture of layout.fixtures) {
    all.push(...generateFixturePoints(fixture))
  }
  const totalBeforeClamp = all.length
  const overflow = totalBeforeClamp > MAX_PIXELS
  return {
    points: overflow ? all.slice(0, MAX_PIXELS) : all,
    overflow,
    totalBeforeClamp
  }
}
