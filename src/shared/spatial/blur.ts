import { spatialCoord, type Resolution } from './resolution'

/** Scatter patch-ordered pixels into a logical-resolution grid (last writer wins). */
export function pixelsToGrid(
  pixels: Float32Array,
  positions: Float32Array,
  pixelCount: number,
  resolution: Resolution
): Float32Array {
  const width = Math.max(1, Math.floor(resolution.width))
  const height = Math.max(1, Math.floor(resolution.height))
  const grid = new Float32Array(width * height * 3)

  for (let j = 0; j < pixelCount; j++) {
    const { cellX, cellY } = spatialCoord(positions, j, resolution)
    const gi = (cellY * width + cellX) * 3
    grid[gi] = pixels[j * 3] ?? 0
    grid[gi + 1] = pixels[j * 3 + 1] ?? 0
    grid[gi + 2] = pixels[j * 3 + 2] ?? 0
  }

  return grid
}

function gridIndex(width: number, height: number, x: number, y: number, wrap: boolean): number {
  let sx = x
  let sy = y
  if (wrap) {
    sx = ((x % width) + width) % width
    sy = ((y % height) + height) % height
  } else {
    sx = sx < 0 ? 0 : sx >= width ? width - 1 : sx
    sy = sy < 0 ? 0 : sy >= height ? height - 1 : sy
  }
  return (sy * width + sx) * 3
}

function boxBlurHorizontal(
  src: Float32Array,
  dst: Float32Array,
  width: number,
  height: number,
  radius: number,
  wrap: boolean
): void {
  const denom = radius * 2 + 1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0
      let g = 0
      let b = 0
      for (let k = -radius; k <= radius; k++) {
        const gi = gridIndex(width, height, x + k, y, wrap)
        r += src[gi] as number
        g += src[gi + 1] as number
        b += src[gi + 2] as number
      }
      const o = (y * width + x) * 3
      dst[o] = r / denom
      dst[o + 1] = g / denom
      dst[o + 2] = b / denom
    }
  }
}

function boxBlurVertical(
  src: Float32Array,
  dst: Float32Array,
  width: number,
  height: number,
  radius: number,
  wrap: boolean
): void {
  const denom = radius * 2 + 1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0
      let g = 0
      let b = 0
      for (let k = -radius; k <= radius; k++) {
        const gi = gridIndex(width, height, x, y + k, wrap)
        r += src[gi] as number
        g += src[gi + 1] as number
        b += src[gi + 2] as number
      }
      const o = (y * width + x) * 3
      dst[o] = r / denom
      dst[o + 1] = g / denom
      dst[o + 2] = b / denom
    }
  }
}

export type BlurDirection = 'both' | 'horizontal' | 'vertical'

/** Separable box blur on an rgb grid (width × height cells). */
export function blurGrid(
  grid: Float32Array,
  width: number,
  height: number,
  radius: number,
  direction: BlurDirection,
  wrap: boolean
): Float32Array {
  const r = Math.max(0, Math.floor(radius))
  if (r === 0) return grid

  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const size = w * h * 3
  const temp = new Float32Array(size)

  if (direction === 'horizontal' || direction === 'both') {
    boxBlurHorizontal(grid, temp, w, h, r, wrap)
  } else {
    temp.set(grid)
  }

  if (direction === 'vertical' || direction === 'both') {
    const out = new Float32Array(size)
    boxBlurVertical(temp, out, w, h, r, wrap)
    return out
  }

  return temp
}

/** Map a blurred grid back to patch order. */
export function gridToPixels(
  grid: Float32Array,
  out: Float32Array,
  positions: Float32Array,
  pixelCount: number,
  resolution: Resolution
): void {
  const width = Math.max(1, Math.floor(resolution.width))
  for (let i = 0; i < pixelCount; i++) {
    const { cellX, cellY } = spatialCoord(positions, i, resolution)
    const gi = (cellY * width + cellX) * 3
    out[i * 3] = grid[gi] ?? 0
    out[i * 3 + 1] = grid[gi + 1] ?? 0
    out[i * 3 + 2] = grid[gi + 2] ?? 0
  }
}
