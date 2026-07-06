import { NODE_PREVIEW_SIZE } from './displaySize'

/** Display size for node thumbnails (upscaled in the UI if eval is smaller). */
export const EFFECT_PREVIEW_SIZE = NODE_PREVIEW_SIZE

/** Eval grid — smaller than display for faster interactive preview updates. */
export const EFFECT_PREVIEW_EVAL_SIZE = 64

const positionCache = new Map<number, Float32Array>()

/** Cell-centred UV positions on a square eval grid. */
export function effectPreviewPositions(size = EFFECT_PREVIEW_EVAL_SIZE): Float32Array {
  let positions = positionCache.get(size)
  if (positions !== undefined) return positions
  positions = new Float32Array(size * size * 3)
  for (let i = 0; i < size * size; i++) {
    const cellX = i % size
    const cellY = Math.floor(i / size)
    positions[i * 3] = (cellX + 0.5) / size
    positions[i * 3 + 1] = (cellY + 0.5) / size
    positions[i * 3 + 2] = 0.5
  }
  positionCache.set(size, positions)
  return positions
}

export function effectPreviewPixelCount(size = EFFECT_PREVIEW_EVAL_SIZE): number {
  return size * size
}

function toByte(pixels: Float32Array, index: number, channel: number): number {
  const v = pixels[index * 3 + channel] as number
  return v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255)
}

/** Convert a full preview-grid float buffer to an RGB thumbnail. */
export function rasterizeEffectPreviewGrid(
  pixels: Float32Array,
  size = EFFECT_PREVIEW_EVAL_SIZE
): {
  data: Uint8Array
  width: number
  height: number
} {
  const data = new Uint8Array(size * size * 3)
  const count = Math.min(size * size, Math.floor(pixels.length / 3))
  for (let i = 0; i < count; i++) {
    const out = i * 3
    data[out] = toByte(pixels, i, 0)
    data[out + 1] = toByte(pixels, i, 1)
    data[out + 2] = toByte(pixels, i, 2)
  }
  return { data, width: size, height: size }
}
