/** Scatter a 1D LED buffer onto a 2D TOP working texture (inverse of UV sample). */

export function rasterizeLedsToTexture(
  pixels: Float32Array,
  positions: Float32Array,
  pixelCount: number,
  width: number,
  height: number
): Float32Array {
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  const out = new Float32Array(w * h * 3)
  const count = Math.min(pixelCount, Math.floor(pixels.length / 3))
  for (let i = 0; i < count; i++) {
    const u = positions[i * 3] ?? 0.5
    const v = positions[i * 3 + 1] ?? 0.5
    const x = Math.max(0, Math.min(w - 1, Math.floor(u * w)))
    const y = Math.max(0, Math.min(h - 1, Math.floor(v * h)))
    const o = (y * w + x) * 3
    out[o] = pixels[i * 3] ?? 0
    out[o + 1] = pixels[i * 3 + 1] ?? 0
    out[o + 2] = pixels[i * 3 + 2] ?? 0
  }
  return out
}

/** Row-major grid fill (resolution cells stretched to texW×texH). */
export function rasterizeLedsToGrid(
  pixels: Float32Array,
  texW: number,
  texH: number,
  resW: number,
  resH: number
): Float32Array {
  const tw = Math.max(1, Math.floor(texW))
  const th = Math.max(1, Math.floor(texH))
  const rw = Math.max(1, Math.floor(resW))
  const rh = Math.max(1, Math.floor(resH))
  const count = Math.min(Math.floor(pixels.length / 3), rw * rh)
  const out = new Float32Array(tw * th * 3)
  for (let y = 0; y < th; y++) {
    const cellY = Math.min(rh - 1, Math.floor((y * rh) / th))
    for (let x = 0; x < tw; x++) {
      const cellX = Math.min(rw - 1, Math.floor((x * rw) / tw))
      const i = cellY * rw + cellX
      const o = (y * tw + x) * 3
      if (i >= count) continue
      out[o] = pixels[i * 3] ?? 0
      out[o + 1] = pixels[i * 3 + 1] ?? 0
      out[o + 2] = pixels[i * 3 + 2] ?? 0
    }
  }
  return out
}
