function lum(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function wrapCoord(v: number, max: number, wrap: boolean): number {
  if (wrap) return ((v % max) + max) % max
  return v < 0 ? 0 : v >= max ? max - 1 : v
}

/** Bilinear sample from a W×H RGB grid at fractional cell coordinates. */
function sampleGrid(
  grid: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  wrap: boolean
): [number, number, number] {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0

  const at = (cx: number, cy: number): [number, number, number] => {
    const sx = wrapCoord(cx, width, wrap)
    const sy = wrapCoord(cy, height, wrap)
    const i = (sy * width + sx) * 3
    return [grid[i] as number, grid[i + 1] as number, grid[i + 2] as number]
  }

  const c00 = at(x0, y0)
  const c10 = at(x0 + 1, y0)
  const c01 = at(x0, y0 + 1)
  const c11 = at(x0 + 1, y0 + 1)

  const out: [number, number, number] = [0, 0, 0]
  for (let c = 0; c < 3; c++) {
    const a = c00[c]! + (c10[c]! - c00[c]!) * fx
    const b = c01[c]! + (c11[c]! - c01[c]!) * fx
    out[c] = a + (b - a) * fy
  }
  return out
}

export type DisplaceMode = 'luminance-x' | 'luminance-y' | 'map'

/**
 * Displace a logical grid by sampling a map (luminance or RG → UV offset).
 */
export function displaceGrid(
  src: Float32Array,
  map: Float32Array,
  width: number,
  height: number,
  amount: number,
  mode: DisplaceMode,
  wrap: boolean
): Float32Array {
  const out = new Float32Array(width * height * 3)
  const amt = Math.max(0, amount)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const mi = (y * width + x) * 3
      const mr = map[mi] as number
      const mg = map[mi + 1] as number
      const mb = map[mi + 2] as number

      let dx = 0
      let dy = 0
      switch (mode) {
        case 'luminance-y':
          dy = lum(mr, mg, mb) * amt
          break
        case 'map':
          dx = (mr - 0.5) * 2 * amt
          dy = (mg - 0.5) * 2 * amt
          break
        case 'luminance-x':
        default:
          dx = lum(mr, mg, mb) * amt
          break
      }

      const [r, g, b] = sampleGrid(src, width, height, x + dx, y + dy, wrap)
      const oi = (y * width + x) * 3
      out[oi] = r
      out[oi + 1] = g
      out[oi + 2] = b
    }
  }
  return out
}

export { pixelsToGrid, gridToPixels } from './blur'
