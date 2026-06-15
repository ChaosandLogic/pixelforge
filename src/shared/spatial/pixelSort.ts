function lum(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export type PixelSortMetric = 'luminance' | 'red' | 'green' | 'blue'
export type PixelSortAxis = 'horizontal' | 'vertical'

/**
 * Sort pixels within each row or column by a colour metric (glitch / art effect).
 */
export function pixelSortGrid(
  grid: Float32Array,
  width: number,
  height: number,
  axis: PixelSortAxis,
  metric: PixelSortMetric,
  reverse: boolean,
  threshold: number
): Float32Array {
  const out = new Float32Array(grid.length)
  out.set(grid)

  const sample = (idx: number): number => {
    const i = idx * 3
    const r = grid[i] as number
    const g = grid[i + 1] as number
    const b = grid[i + 2] as number
    switch (metric) {
      case 'red':
        return r
      case 'green':
        return g
      case 'blue':
        return b
      default:
        return lum(r, g, b)
    }
  }

  const metricVal = (r: number, g: number, b: number): number => {
    switch (metric) {
      case 'red':
        return r
      case 'green':
        return g
      case 'blue':
        return b
      default:
        return lum(r, g, b)
    }
  }

  const sortSpan = (indices: number[]): void => {
    const span: number[] = []
    for (const idx of indices) {
      if (sample(idx) >= threshold) span.push(idx)
    }
    if (span.length < 2) return

    // Keep span in spatial order; sort colours only, then write back along the row/column.
    const colors = span.map((idx) => {
      const i = idx * 3
      return [grid[i] as number, grid[i + 1] as number, grid[i + 2] as number] as const
    })
    colors.sort((a, b) => {
      const da = metricVal(a[0], a[1], a[2])
      const db = metricVal(b[0], b[1], b[2])
      return reverse ? db - da : da - db
    })
    for (let i = 0; i < span.length; i++) {
      const dst = span[i] as number
      const c = colors[i]!
      const o = dst * 3
      out[o] = c[0]
      out[o + 1] = c[1]
      out[o + 2] = c[2]
    }
  }

  if (axis === 'horizontal') {
    for (let y = 0; y < height; y++) {
      const row: number[] = []
      for (let x = 0; x < width; x++) row.push(y * width + x)
      sortSpan(row)
    }
  } else {
    for (let x = 0; x < width; x++) {
      const col: number[] = []
      for (let y = 0; y < height; y++) col.push(y * width + x)
      sortSpan(col)
    }
  }

  return out
}
