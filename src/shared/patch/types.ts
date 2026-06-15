/**
 * Patch model. Points carry only an id and a position — no per-pixel
 * universe/channel. Pixel order IS the channel order: the engine emits one
 * flat RGB channel stream in patch order, and the output protocol chunks it
 * downstream (sACN: 510 channels per universe; DDP later: offset packets,
 * no universe limit).
 */

export interface PatchPoint {
  id: string
  x: number
  y: number
  z: number
}

import type { LayoutData } from './layout'

export interface PatchData {
  points: PatchPoint[]
  /** Editable layout recipe; absent when patch was imported from file. */
  layout?: LayoutData
}

/** 170 RGB pixels per DMX universe (510 of 512 channels used). */
export const CHANNELS_PER_UNIVERSE = 510

export function universeCountFor(pixelCount: number): number {
  return Math.max(1, Math.ceil((pixelCount * 3) / CHANNELS_PER_UNIVERSE))
}

/** Derived mapping for display: where a point lands in the sACN stream. */
export function deriveAddress(index: number, startUniverse: number): { universe: number; channel: number } {
  const channelIndex = index * 3
  return {
    universe: startUniverse + Math.floor(channelIndex / CHANNELS_PER_UNIVERSE),
    channel: (channelIndex % CHANNELS_PER_UNIVERSE) + 1
  }
}

export function generateLinePatch(count: number): PatchPoint[] {
  const denom = Math.max(1, count - 1)
  const points: PatchPoint[] = []
  for (let i = 0; i < count; i++) {
    points.push({ id: `p${i}`, x: i / denom, y: 0.5, z: 0 })
  }
  return points
}

/** Pack points into a transferable xyz triplet array for the engine. */
export function pointsToPositions(points: PatchPoint[]): Float32Array {
  const positions = new Float32Array(points.length * 3)
  for (let i = 0; i < points.length; i++) {
    const p = points[i] as PatchPoint
    positions[i * 3] = p.x
    positions[i * 3 + 1] = p.y
    positions[i * 3 + 2] = p.z
  }
  return positions
}
