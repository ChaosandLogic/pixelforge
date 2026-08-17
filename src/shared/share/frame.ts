/** CPU helpers for Syphon/Spout frames (RGB engine ↔ BGRA native). */

export const SHARE_MAX_SAMPLE = 128
export const SHARE_MAX_TEXTURE = 1024

export function clampShareSize(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.max(16, Math.min(SHARE_MAX_TEXTURE, Math.floor(value)))
}

/** Nearest-neighbour downsample of packed RGBA (or BGRA) to RGB triplets. */
export function samplePackedToRgb(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  srcIsBgra = false
): Uint8Array {
  const width = Math.max(1, Math.floor(dstW))
  const height = Math.max(1, Math.floor(dstH))
  const out = new Uint8Array(width * height * 3)
  if (srcW <= 0 || srcH <= 0) return out

  const rOff = srcIsBgra ? 2 : 0
  const bOff = srcIsBgra ? 0 : 2

  for (let y = 0; y < height; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y + 0.5) * srcH / height))
    for (let x = 0; x < width; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x + 0.5) * srcW / width))
      const si = (sy * srcW + sx) * 4
      const di = (y * width + x) * 3
      out[di] = src[si + rOff] ?? 0
      out[di + 1] = src[si + 1] ?? 0
      out[di + 2] = src[si + bOff] ?? 0
    }
  }
  return out
}

export function sampleSizeFor(srcW: number, srcH: number): { width: number; height: number } {
  const w = Math.max(1, srcW)
  const h = Math.max(1, srcH)
  if (w <= SHARE_MAX_SAMPLE && h <= SHARE_MAX_SAMPLE) return { width: w, height: h }
  if (w >= h) {
    return {
      width: SHARE_MAX_SAMPLE,
      height: Math.max(1, Math.round((h / w) * SHARE_MAX_SAMPLE))
    }
  }
  return {
    width: Math.max(1, Math.round((w / h) * SHARE_MAX_SAMPLE)),
    height: SHARE_MAX_SAMPLE
  }
}

function toByte(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255)
}

/** Stretch a row-major RGB float stream (resW×resH cells) into a BGRA texture. */
export function streamToBgra(
  pixels: Float32Array,
  resW: number,
  resH: number,
  texW: number,
  texH: number
): Uint8Array {
  const tw = Math.max(1, texW)
  const th = Math.max(1, texH)
  const rw = Math.max(1, Math.floor(resW))
  const rh = Math.max(1, Math.floor(resH))
  const count = Math.min(Math.floor(pixels.length / 3), rw * rh)
  const out = new Uint8Array(tw * th * 4)

  for (let y = 0; y < th; y++) {
    const cellY = Math.min(rh - 1, Math.floor((y * rh) / th))
    for (let x = 0; x < tw; x++) {
      const cellX = Math.min(rw - 1, Math.floor((x * rw) / tw))
      const i = cellY * rw + cellX
      const o = (y * tw + x) * 4
      if (i >= count) {
        out[o + 3] = 255
        continue
      }
      out[o] = toByte(pixels[i * 3 + 2] as number)
      out[o + 1] = toByte(pixels[i * 3 + 1] as number)
      out[o + 2] = toByte(pixels[i * 3] as number)
      out[o + 3] = 255
    }
  }
  return out
}

/** Map patch XY (normalised 0..1) into a BGRA texture. */
export function layoutToBgra(
  pixels: Float32Array,
  positions: Float32Array,
  pixelCount: number,
  texW: number,
  texH: number
): Uint8Array {
  const tw = Math.max(1, texW)
  const th = Math.max(1, texH)
  const out = new Uint8Array(tw * th * 4)
  for (let i = 0; i < tw * th; i++) {
    out[i * 4] = 10
    out[i * 4 + 1] = 13
    out[i * 4 + 2] = 18
    out[i * 4 + 3] = 255
  }

  const count = Math.min(pixelCount, Math.floor(pixels.length / 3))
  if (count === 0) return out

  const margin = 4
  const innerW = Math.max(1, tw - margin * 2)
  const innerH = Math.max(1, th - margin * 2)
  const dotR = Math.max(1, Math.min(4, Math.floor(Math.sqrt((innerW * innerH) / count) * 0.35)))
  const r2 = dotR * dotR

  for (let i = 0; i < count; i++) {
    const u = positions[i * 3] ?? 0.5
    const v = positions[i * 3 + 1] ?? 0.5
    const cx = Math.round(margin + u * innerW)
    const cy = Math.round(margin + v * innerH)
    const b = toByte(pixels[i * 3 + 2] as number)
    const g = toByte(pixels[i * 3 + 1] as number)
    const r = toByte(pixels[i * 3] as number)
    for (let dy = -dotR; dy <= dotR; dy++) {
      for (let dx = -dotR; dx <= dotR; dx++) {
        if (dx * dx + dy * dy > r2) continue
        const sx = cx + dx
        const sy = cy + dy
        if (sx < 0 || sy < 0 || sx >= tw || sy >= th) continue
        const o = (sy * tw + sx) * 4
        out[o] = b
        out[o + 1] = g
        out[o + 2] = r
        out[o + 3] = 255
      }
    }
  }
  return out
}
