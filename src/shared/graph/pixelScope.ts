import { indicesForFixture } from '../patch/fixtureRoute'
import type { Resolution } from '../spatial/resolution'
import { spatialCoord } from '../spatial/resolution'
import type { EvalContext } from './types'
import {
  scopeBounds,
  scopeCellCoord,
  type GeneratorScope
} from './generatorScope'

/** Fixture or full-patch pixel iteration scope (same shape as generator scope). */
export type PixelScope = GeneratorScope

function fullPatchScope(ctx: EvalContext): PixelScope {
  const indices: number[] = []
  for (let i = 0; i < ctx.pixelCount; i++) indices.push(i)
  return {
    indices,
    resolution: ctx.resolution,
    fullPatch: true,
    count: ctx.pixelCount
  }
}

/** Infer pixel scope from buffer length and fixture layout. */
export function pixelScopeFromSrc(src: Float32Array, ctx: EvalContext): PixelScope {
  const fullLen = ctx.pixelCount * 3
  if (src.length >= fullLen) return fullPatchScope(ctx)

  const count = Math.floor(src.length / 3)
  if (count <= 0) return fullPatchScope(ctx)

  const range = ctx.fixtureRanges.find((r) => r.count === count)
  if (range !== undefined) {
    return {
      indices: indicesForFixture(range.id, ctx.fixtureRanges),
      resolution: { width: range.width, height: range.height },
      fullPatch: false,
      count
    }
  }

  const indices: number[] = []
  for (let i = 0; i < count; i++) indices.push(i)
  return {
    indices,
    resolution: ctx.resolution,
    fullPatch: count >= ctx.pixelCount,
    count
  }
}

/** Full-patch output buffer cleared to black. */
export function beginScopedPixelOutput(ctx: EvalContext): Float32Array {
  const out = ctx.acquire()
  out.fill(0)
  return out
}

export function scopeSrcOffset(scope: PixelScope, localIndex: number): number {
  return scope.fullPatch ? (scope.indices[localIndex] as number) * 3 : localIndex * 3
}

export function scopeDstOffset(scope: PixelScope, localIndex: number): number {
  return (scope.indices[localIndex] as number) * 3
}

/** Normalised 0..1 position along the scoped stream. */
export function scopedNormalizedU(scope: PixelScope, localIndex: number): number {
  if (scope.count <= 1) return 0
  return localIndex / (scope.count - 1)
}

export function readScopedRgb(
  src: Float32Array,
  scope: PixelScope,
  localIndex: number
): [number, number, number] {
  const o = scopeSrcOffset(scope, localIndex)
  return [src[o] as number, src[o + 1] as number, src[o + 2] as number]
}

export function writeScopedRgb(
  out: Float32Array,
  scope: PixelScope,
  localIndex: number,
  r: number,
  g: number,
  b: number
): void {
  const o = scopeDstOffset(scope, localIndex)
  out[o] = r
  out[o + 1] = g
  out[o + 2] = b
}

/** Map RGB over scoped pixels into a full-patch output buffer. */
export function mapScopedPixels(
  src: Float32Array,
  ctx: EvalContext,
  fn: (r: number, g: number, b: number, localIndex: number) => [number, number, number]
): Float32Array {
  const scope = pixelScopeFromSrc(src, ctx)
  const out = beginScopedPixelOutput(ctx)
  for (let i = 0; i < scope.count; i++) {
    const [r, g, b] = readScopedRgb(src, scope, i)
    const mapped = fn(r, g, b, i)
    writeScopedRgb(out, scope, i, mapped[0], mapped[1], mapped[2])
  }
  return out
}

/** Remap along scoped strip index; mapU returns source u in 0..1 (caller applies edge mode). */
export function remapScopedStrip(
  src: Float32Array,
  ctx: EvalContext,
  mapU: (localIndex: number, u: number, scope: PixelScope) => number
): Float32Array {
  const scope = pixelScopeFromSrc(src, ctx)
  const out = beginScopedPixelOutput(ctx)
  const denom = Math.max(1, scope.count - 1)

  for (let i = 0; i < scope.count; i++) {
    const u = scopedNormalizedU(scope, i)
    const v = mapU(i, u, scope)
    const jLocal = Math.min(scope.count - 1, Math.max(0, Math.round(v * denom)))
    const [r, g, b] = readScopedRgb(src, scope, jLocal)
    writeScopedRgb(out, scope, i, r, g, b)
  }
  return out
}

/** Resolution for grid ops: fixture-local when input is compact. */
export function scopedResolution(
  scope: PixelScope,
  fallback: Resolution
): Resolution {
  return scope.fullPatch ? fallback : scope.resolution
}

/** Scatter scoped pixels into a logical-resolution grid. */
export function pixelsToGridScoped(
  pixels: Float32Array,
  positions: Float32Array,
  scope: PixelScope,
  resolution: Resolution
): Float32Array {
  const width = Math.max(1, Math.floor(resolution.width))
  const height = Math.max(1, Math.floor(resolution.height))
  const grid = new Float32Array(width * height * 3)
  const bounds = scope.fullPatch ? undefined : scopeBounds(positions, scope)

  for (let i = 0; i < scope.count; i++) {
    const patchIdx = scope.indices[i] as number
    const { cellX, cellY } = scope.fullPatch
      ? spatialCoord(positions, patchIdx, resolution)
      : scopeCellCoord(positions, patchIdx, scope, bounds)
    const gi = (cellY * width + cellX) * 3
    const si = scopeSrcOffset(scope, i)
    grid[gi] = pixels[si] ?? 0
    grid[gi + 1] = pixels[si + 1] ?? 0
    grid[gi + 2] = pixels[si + 2] ?? 0
  }

  return grid
}

/** Map a grid back onto scoped patch indices in out (sparse full-patch write). */
export function gridToPixelsScoped(
  grid: Float32Array,
  out: Float32Array,
  positions: Float32Array,
  scope: PixelScope,
  resolution: Resolution
): void {
  const width = Math.max(1, Math.floor(resolution.width))
  const bounds = scope.fullPatch ? undefined : scopeBounds(positions, scope)

  for (let i = 0; i < scope.count; i++) {
    const patchIdx = scope.indices[i] as number
    const { cellX, cellY } = scope.fullPatch
      ? spatialCoord(positions, patchIdx, resolution)
      : scopeCellCoord(positions, patchIdx, scope, bounds)
    const gi = (cellY * width + cellX) * 3
    const dst = patchIdx * 3
    out[dst] = grid[gi] ?? 0
    out[dst + 1] = grid[gi + 1] ?? 0
    out[dst + 2] = grid[gi + 2] ?? 0
  }
}

/** Expand a compact fixture buffer to a full-patch buffer for compositing. */
export function pixelsForBlend(src: Float32Array | null, ctx: EvalContext): Float32Array | null {
  if (src === null) return null
  const fullLen = ctx.pixelCount * 3
  if (src.length >= fullLen) return src

  const scope = pixelScopeFromSrc(src, ctx)
  const out = beginScopedPixelOutput(ctx)
  for (let i = 0; i < scope.count; i++) {
    const [r, g, b] = readScopedRgb(src, scope, i)
    writeScopedRgb(out, scope, i, r, g, b)
  }
  return out
}

/** Apply edge wrapping/clamping for normalised strip coordinate v. */
export function applyEdgeMode(v: number, edges: 'wrap' | 'clamp' | 'mirror'): number {
  if (edges === 'wrap') return v - Math.floor(v)
  if (edges === 'mirror') {
    const t = Math.abs(v) % 2
    return t > 1 ? 2 - t : t
  }
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Copy scoped pixels to a full-patch output (passthrough). */
export function copyScopedPixels(src: Float32Array, ctx: EvalContext): Float32Array {
  const scope = pixelScopeFromSrc(src, ctx)
  const out = beginScopedPixelOutput(ctx)
  for (let i = 0; i < scope.count; i++) {
    const [r, g, b] = readScopedRgb(src, scope, i)
    writeScopedRgb(out, scope, i, r, g, b)
  }
  return out
}
