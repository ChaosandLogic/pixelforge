import { spatialCoord, type Resolution } from '../spatial/resolution'

const AXES = ['x', 'y', 'z', 'xy', 'index'] as const
export type SpatialAxis = (typeof AXES)[number]

export const SPATIAL_AXIS_OPTIONS: readonly SpatialAxis[] = AXES

export const GRADIENT_AXIS_OPTIONS = [...SPATIAL_AXIS_OPTIONS, 'circular'] as const
export type GradientAxis = SpatialAxis | 'circular'

export function parseSpatialAxis(value: string): SpatialAxis {
  return AXES.includes(value as SpatialAxis) ? (value as SpatialAxis) : 'x'
}

export function parseGradientAxis(value: string): GradientAxis {
  return value === 'circular' ? 'circular' : parseSpatialAxis(value)
}

/** Euclidean distance from a centre in normalised layout space (0 at centre). */
export function radialDistance(
  u: number,
  v: number,
  z: number,
  centreX = 0.5,
  centreY = 0.5,
  centreZ = 0.5
): number {
  const dx = u - centreX
  const dy = v - centreY
  const dz = z - centreZ
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/** Cell-centred UV (0..1) for quantised grid sampling. */
export function cellCentreUv(
  positions: Float32Array,
  index: number,
  resolution: Resolution
): { u: number; v: number } {
  const { u, v, cellX, cellY } = spatialCoord(positions, index, resolution)
  const { width, height } = resolution
  return {
    u: width > 1 ? (cellX + 0.5) / width : u,
    v: height > 1 ? (cellY + 0.5) / height : v
  }
}

/** Sample position along a logical axis using cell-centred coordinates. */
export function axisPosition(
  positions: Float32Array,
  index: number,
  resolution: Resolution,
  axis: SpatialAxis,
  pixelCount?: number
): number {
  const { u, v, cellX, cellY } = spatialCoord(positions, index, resolution)
  const { width, height } = resolution
  switch (axis) {
    case 'x':
      return width > 1 ? (cellX + 0.5) / width : u
    case 'y':
      return height > 1 ? (cellY + 0.5) / height : v
    case 'z':
      return positions[index * 3 + 2] ?? 0
    case 'xy':
      return width + height > 0 ? (cellX + cellY) / (width + height) : u
    case 'index': {
      const n = pixelCount ?? width * height
      return n > 1 ? index / (n - 1) : 0
    }
  }
}
