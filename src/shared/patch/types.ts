/**
 * Patch model. Points carry only an id and a position — no per-pixel
 * universe/channel. Pixel order IS the channel order: the engine emits one
 * flat RGB stream in patch order. Pixel Output may expand to RGBW, then the
 * protocol chunks it (sACN/Art-Net: 510 RGB or 512 RGBW channels per universe;
 * DDP: offset packets, no universe limit).
 */

export interface PatchPoint {
  id: string
  x: number
  y: number
  z: number
}

import type { ColorMode } from '../output/rgbw'
import { channelsPerPixel, dmxChannelsPerUniverse } from '../output/rgbw'
import type { LayoutData } from './layout'

export interface PatchData {
  points: PatchPoint[]
  /** Editable layout recipe; absent when patch was imported from file. */
  layout?: LayoutData
}

/** 170 RGB pixels per DMX universe (510 of 512 channels used). */
export const CHANNELS_PER_UNIVERSE = 510

export function universeCountFor(pixelCount: number, colorMode: ColorMode = 'rgb'): number {
  const cpp = channelsPerPixel(colorMode)
  return Math.max(1, Math.ceil((pixelCount * cpp) / dmxChannelsPerUniverse(colorMode)))
}

/** Derived mapping for display: where a point lands in the sACN/Art-Net stream. */
export function deriveAddress(
  index: number,
  startUniverse: number,
  colorMode: ColorMode = 'rgb'
): { universe: number; channel: number } {
  const perUniverse = dmxChannelsPerUniverse(colorMode)
  const channelIndex = index * channelsPerPixel(colorMode)
  return {
    universe: startUniverse + Math.floor(channelIndex / perUniverse),
    channel: (channelIndex % perUniverse) + 1
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
