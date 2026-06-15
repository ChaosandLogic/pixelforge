import { NODE_PREVIEW_SIZE } from './displaySize'
import type { Resolution } from '../spatial/resolution'

interface RasterPreview {
  data: Uint8Array
  width: number
  height: number
}

function toByte(pixels: Float32Array, index: number, channel: number): number {
  const v = pixels[index * 3 + channel] as number
  return v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255)
}

/** Logical grid that fits `streamCount` pixels (row-major). */
export function previewResolutionForStream(streamCount: number, fallback: Resolution): Resolution {
  const n = Math.max(1, streamCount)
  const resW = Math.max(1, Math.floor(fallback.width))
  const resH = Math.max(1, Math.floor(fallback.height))
  if (resW * resH >= n) return { width: resW, height: resH }
  return { width: n, height: 1 }
}

/** Gather patch indices into a compact stream for fixture previews. */
export function compactStreamPixels(pixels: Float32Array, indices: number[]): Float32Array {
  const out = new Float32Array(indices.length * 3)
  for (let i = 0; i < indices.length; i++) {
    const g = indices[i] as number
    out[i * 3] = pixels[g * 3] as number
    out[i * 3 + 1] = pixels[g * 3 + 1] as number
    out[i * 3 + 2] = pixels[g * 3 + 2] as number
  }
  return out
}

/**
 * Rasterise a pixel stream into NODE_PREVIEW_SIZE², stretching the logical
 * resolution to fill the square (TouchDesigner-style — not patch layout).
 */
export function rasterizeStream(pixels: Float32Array, resolution: Resolution): RasterPreview {
  const size = NODE_PREVIEW_SIZE
  const data = new Uint8Array(size * size * 3)
  const resW = Math.max(1, Math.floor(resolution.width))
  const resH = Math.max(1, Math.floor(resolution.height))
  const streamCount = Math.floor(pixels.length / 3)
  const count = Math.min(streamCount, resW * resH)

  const cellW = size / resW
  const cellH = size / resH

  for (let i = 0; i < count; i++) {
    const cellX = i % resW
    const cellY = Math.floor(i / resW)
    const x0 = Math.floor(cellX * cellW)
    const x1 = cellX === resW - 1 ? size : Math.floor((cellX + 1) * cellW)
    const y0 = Math.floor(cellY * cellH)
    const y1 = cellY === resH - 1 ? size : Math.floor((cellY + 1) * cellH)
    const r = toByte(pixels, i, 0)
    const g = toByte(pixels, i, 1)
    const b = toByte(pixels, i, 2)

    for (let sy = y0; sy < y1; sy++) {
      for (let sx = x0; sx < x1; sx++) {
        const out = (sy * size + sx) * 3
        data[out] = r
        data[out + 1] = g
        data[out + 2] = b
      }
    }
  }

  return { data, width: size, height: size }
}

const LAYOUT_BG = { r: 10, g: 13, b: 18 }

function paintDot(
  data: Uint8Array,
  size: number,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number
): void {
  const r2 = radius * radius
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue
      const sx = cx + dx
      const sy = cy + dy
      if (sx < 0 || sy < 0 || sx >= size || sy >= size) continue
      const out = (sy * size + sx) * 3
      data[out] = r
      data[out + 1] = g
      data[out + 2] = b
    }
  }
}

/**
 * Rasterise patch pixels at their physical layout positions (normalised 0..1),
 * matching the layout preview / LED appearance.
 */
export function rasterizeLayout(
  pixels: Float32Array,
  positions: Float32Array,
  pixelCount: number,
  size = NODE_PREVIEW_SIZE
): RasterPreview {
  const data = new Uint8Array(size * size * 3)
  for (let i = 0; i < size * size; i++) {
    data[i * 3] = LAYOUT_BG.r
    data[i * 3 + 1] = LAYOUT_BG.g
    data[i * 3 + 2] = LAYOUT_BG.b
  }

  const count = Math.min(pixelCount, Math.floor(pixels.length / 3))
  if (count === 0) return { data, width: size, height: size }

  const margin = 8
  const inner = Math.max(1, size - margin * 2)
  const dotR = Math.max(1, Math.min(3, Math.floor(Math.sqrt(inner * inner / count) * 0.35)))

  for (let i = 0; i < count; i++) {
    const u = positions[i * 3] ?? 0.5
    const v = positions[i * 3 + 1] ?? 0.5
    const sx = Math.round(margin + u * inner)
    const sy = Math.round(margin + v * inner)
    paintDot(data, size, sx, sy, dotR, toByte(pixels, i, 0), toByte(pixels, i, 1), toByte(pixels, i, 2))
  }

  return { data, width: size, height: size }
}

/** @deprecated Use rasterizeStream — kept as alias for callers migrating. */
export const rasterizePixels = rasterizeStream
