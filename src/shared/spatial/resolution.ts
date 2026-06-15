import type { LayoutData } from '../patch/layout'

export const RESOLUTION_NODE_TYPE = 'setup/resolution'

export interface Resolution {
  width: number
  height: number
  /** When set, downstream generators write only these patch indices. */
  indices?: number[]
}

/** Default for 1D strips: N×1 logical grid. */
export function defaultResolution(pixelCount: number): Resolution {
  return { width: Math.max(1, pixelCount), height: 1 }
}

/**
 * Infer logical resolution from layout fixtures. Uses the largest matrix
 * fixture; falls back to pixelCount×1 for lines/rings only.
 */
export function inferResolutionFromLayout(layout: LayoutData | null, pixelCount: number): Resolution {
  if (layout === null) return defaultResolution(pixelCount)

  let best: Resolution | null = null
  let bestArea = 0
  for (const fixture of layout.fixtures) {
    if (fixture.def.kind === 'matrix') {
      const w = Math.max(1, Math.floor(fixture.def.cols))
      const h = Math.max(1, Math.floor(fixture.def.rows))
      const area = w * h
      if (area > bestArea) {
        bestArea = area
        best = { width: w, height: h }
      }
    }
  }
  return best ?? defaultResolution(pixelCount)
}

interface SpatialCoord {
  /** Normalised 0..1 from patch position */
  u: number
  v: number
  /** Discrete cell index in logical resolution grid */
  cellX: number
  cellY: number
}

/** Map a patch point to logical UV and cell coordinates. */
export function spatialCoord(
  positions: Float32Array,
  index: number,
  resolution: Resolution
): SpatialCoord {
  const u = positions[index * 3] ?? 0
  const v = positions[index * 3 + 1] ?? 0
  const { width, height } = resolution
  return {
    u,
    v,
    cellX: Math.min(width - 1, Math.max(0, Math.floor(u * width))),
    cellY: Math.min(height - 1, Math.max(0, Math.floor(v * height)))
  }
}

/** 1D hash -> 0..1 */
function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return s - Math.floor(s)
}

/** Smooth 2D value noise in cell space. */
export function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)

  const a = hash1(ix + iy * 57.0)
  const b = hash1(ix + 1 + iy * 57.0)
  const c = hash1(ix + (iy + 1) * 57.0)
  const d = hash1(ix + 1 + (iy + 1) * 57.0)

  const ab = a + (b - a) * ux
  const cd = c + (d - c) * ux
  return ab + (cd - ab) * uy
}

