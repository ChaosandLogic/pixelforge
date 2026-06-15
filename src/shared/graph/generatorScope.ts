import { indicesForFixture } from '../patch/fixtureRoute'
import { axisPosition, type SpatialAxis } from './spatial'
import { pixelsInput, resolutionInput, type EvalContext, type PortValues } from './types'
import type { Resolution } from '../spatial/resolution'
import { spatialCoord } from '../spatial/resolution'

export interface GeneratorScope {
  /** Global patch indices to write, one per generated pixel. */
  indices: number[]
  resolution: Resolution
  /** True when writing the full patch (indices[i] === i). */
  fullPatch: boolean
  count: number
}

/** Resolve fixture-scoped or full-patch generation from optional pixels + resolution inputs. */
export function generatorScope(inputs: PortValues, ctx: EvalContext): GeneratorScope {
  const resolution = resolutionInput(inputs, ctx)
  const src = pixelsInput(inputs, 'pixels')
  const fullLen = ctx.pixelCount * 3

  if (resolution.indices !== undefined && resolution.indices.length > 0) {
    return {
      indices: resolution.indices,
      resolution: { width: resolution.width, height: resolution.height },
      fullPatch: false,
      count: resolution.indices.length
    }
  }

  if (src !== null && src.length < fullLen) {
    const count = Math.floor(src.length / 3)
    const range = ctx.fixtureRanges.find((r) => r.count === count)
    if (range !== undefined) {
      return {
        indices: indicesForFixture(range.id, ctx.fixtureRanges),
        resolution: { width: range.width, height: range.height },
        fullPatch: false,
        count
      }
    }
  }

  const indices: number[] = []
  for (let i = 0; i < ctx.pixelCount; i++) indices.push(i)
  return {
    indices,
    resolution,
    fullPatch: true,
    count: ctx.pixelCount
  }
}

/** Patch index for a local generator sample. */
export function scopePatchIndex(scope: GeneratorScope, localIndex: number): number {
  return scope.fullPatch ? localIndex : (scope.indices[localIndex] as number)
}

/** UV bounds of pixels in the current scope (for fixture-local grid mapping). */
export interface ScopeBounds {
  minU: number
  maxU: number
  minV: number
  maxV: number
}

export function scopeBounds(positions: Float32Array, scope: GeneratorScope): ScopeBounds {
  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity
  for (let i = 0; i < scope.count; i++) {
    const idx = scope.indices[i] as number
    const u = positions[idx * 3] ?? 0
    const v = positions[idx * 3 + 1] ?? 0
    if (u < minU) minU = u
    if (u > maxU) maxU = u
    if (v < minV) minV = v
    if (v > maxV) maxV = v
  }
  if (!Number.isFinite(minU)) return { minU: 0, maxU: 1, minV: 0, maxV: 1 }
  return { minU, maxU, minV, maxV }
}

/**
 * Map a patch index to a logical grid cell for raster output.
 * Fixture-scoped: uses fixture-local UV (not stream index) so text/images
 * align with physical matrix layout regardless of wiring order.
 */
export function scopeCellCoord(
  positions: Float32Array,
  patchIdx: number,
  scope: GeneratorScope,
  bounds?: ScopeBounds
): { cellX: number; cellY: number } {
  const width = Math.max(1, Math.floor(scope.resolution.width))
  const height = Math.max(1, Math.floor(scope.resolution.height))

  if (scope.fullPatch) {
    const c = spatialCoord(positions, patchIdx, scope.resolution)
    return { cellX: c.cellX, cellY: c.cellY }
  }

  const b = bounds ?? scopeBounds(positions, scope)
  const u = positions[patchIdx * 3] ?? 0
  const v = positions[patchIdx * 3 + 1] ?? 0
  const nu = b.maxU > b.minU ? (u - b.minU) / (b.maxU - b.minU) : 0.5
  const nv = b.maxV > b.minV ? (v - b.minV) / (b.maxV - b.minV) : 0.5

  const cellX =
    width <= 1 ? 0 : Math.min(width - 1, Math.max(0, Math.round(nu * (width - 1))))
  const cellY =
    height <= 1 ? 0 : Math.min(height - 1, Math.max(0, Math.round(nv * (height - 1))))
  return { cellX, cellY }
}

/** UV / cell coords for scoped sampling (fixture-local grid when scoped). */
export function scopeUv(
  positions: Float32Array,
  localIndex: number,
  scope: GeneratorScope,
  bounds?: ScopeBounds
): { u: number; v: number; cellX: number; cellY: number } {
  const { width, height } = scope.resolution
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  const patchIdx = scopePatchIndex(scope, localIndex)
  const { cellX, cellY } = scopeCellCoord(positions, patchIdx, scope, bounds)
  return {
    cellX,
    cellY,
    u: w > 1 ? (cellX + 0.5) / w : 0,
    v: h > 1 ? (cellY + 0.5) / h : 0
  }
}

/** Axis position for scoped generators. */
export function scopeAxisPosition(
  positions: Float32Array,
  localIndex: number,
  scope: GeneratorScope,
  axis: SpatialAxis
): number {
  if (scope.fullPatch) {
    return axisPosition(positions, localIndex, scope.resolution, axis, scope.count)
  }
  const global = scopePatchIndex(scope, localIndex)
  if (axis === 'z') return positions[global * 3 + 2] ?? 0
  const { width, height } = scope.resolution
  const cellX = localIndex % width
  const cellY = Math.floor(localIndex / width)
  switch (axis) {
    case 'x':
      return width > 1 ? (cellX + 0.5) / width : 0
    case 'y':
      return height > 1 ? (cellY + 0.5) / height : 0
    case 'xy':
      return width + height > 0 ? (cellX + cellY) / (width + height) : 0
    case 'index':
      return scope.count > 1 ? localIndex / (scope.count - 1) : 0
    default:
      return axisPosition(positions, global, scope.resolution, axis, scope.count)
  }
}

/** Begin a scoped generator output buffer (full patch, sparse writes). */
export function beginScopedOutput(ctx: EvalContext): Float32Array {
  const out = ctx.acquire()
  out.fill(0)
  return out
}
