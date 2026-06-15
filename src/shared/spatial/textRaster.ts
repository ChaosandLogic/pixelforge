/** 5×7 bitmap glyphs for digits, letters, and common punctuation. */
import {
  scopeBounds,
  scopeCellCoord,
  type GeneratorScope,
  type ScopeBounds
} from '../graph/generatorScope'
const GLYPHS: Record<string, readonly number[]> = {
  ' ': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '0': [0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  '1': [0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  '2': [0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  '3': [0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  '4': [0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  '5': [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  '6': [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  '7': [1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '8': [0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  '9': [0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ':': [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  '-': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  A: [0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  B: [1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  C: [0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  D: [1, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  E: [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  F: [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  G: [0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  H: [1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  I: [0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  J: [0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  K: [1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  L: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  M: [1, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  N: [1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  O: [0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  P: [1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Q: [0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  R: [1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  S: [0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  T: [1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  U: [1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  V: [1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  W: [1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  X: [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  Y: [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  Z: [1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0]
}

const GW = 5
const GH = 7

function glyph(ch: string): readonly number[] {
  const key = ch in GLYPHS ? ch : ch.toUpperCase() in GLYPHS ? ch.toUpperCase() : ' '
  return GLYPHS[key] ?? GLYPHS[' ']!
}

export interface TextRasterOptions {
  text: string
  width: number
  height: number
  anchorX: number
  anchorY: number
  scale: number
  align: 'left' | 'center' | 'right'
  r: number
  g: number
  b: number
  /** Outline width in grid pixels; 0 disables stroke. */
  strokeSize: number
  background: number
  /** Horizontal scroll offset in grid pixels (positive moves text left). */
  scroll: number
  /** Gap between repeated text tiles in grid pixels. */
  spacing: number
  /** When true, repeat text horizontally for marquee scrolling. */
  tiled: boolean
}

interface TextMetrics {
  chars: string
  charW: number
  totalW: number
  sx: number
  sy: number
}

function textMetrics(text: string, scale: number): TextMetrics {
  const mag = Math.abs(scale)
  const charW = GW * mag + mag
  const chars = text.toUpperCase().slice(0, 64)
  const totalW = chars.length > 0 ? chars.length * charW - mag : 0
  return { chars, charW, totalW, sx: scale, sy: mag }
}

function modPos(value: number, period: number): number {
  if (period <= 0) return 0
  return value - Math.floor(value / period) * period
}

function alignedStartX(
  anchorX: number,
  totalW: number,
  align: 'left' | 'center' | 'right'
): number {
  let startX = anchorX
  if (align === 'center') startX -= totalW / 2
  else if (align === 'right') startX -= totalW
  return startX
}

function paintRect(
  grid: Float32Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number,
  expand = 0
): void {
  const px0 = Math.max(0, Math.floor(Math.min(x0, x1) - expand))
  const py0 = Math.max(0, Math.floor(Math.min(y0, y1) - expand))
  const px1 = Math.min(width, Math.ceil(Math.max(x0, x1) + expand))
  const py1 = Math.min(height, Math.ceil(Math.max(y0, y1) + expand))
  for (let py = py0; py < py1; py++) {
    for (let px = px0; px < px1; px++) {
      const i = (py * width + px) * 3
      grid[i] = r
      grid[i + 1] = g
      grid[i + 2] = b
    }
  }
}

function paintGlyphs(
  grid: Float32Array,
  gridW: number,
  gridH: number,
  startX: number,
  anchorY: number,
  metrics: TextMetrics,
  r: number,
  g: number,
  b: number,
  stroke: number
): void {
  const { chars, charW, sx, sy } = metrics
  for (let ci = 0; ci < chars.length; ci++) {
    const bits = glyph(chars[ci]!)
    const baseX = startX + ci * charW
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        if (bits[gy * GW + gx] !== 1) continue
        const x0 = baseX + gx * sx
        const y0 = anchorY + gy * sy
        const x1 = x0 + sx
        const y1 = y0 + sy
        if (stroke > 0) {
          paintRect(grid, gridW, gridH, x0, y0, x1, y1, 1 - r, 1 - g, 1 - b, stroke)
        }
        paintRect(grid, gridW, gridH, x0, y0, x1, y1, r, g, b)
      }
    }
  }
}

function fillBackground(grid: Float32Array, width: number, height: number, background: number): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      grid[i] = background
      grid[i + 1] = background
      grid[i + 2] = background
    }
  }
}

/** Paint text into a W×H RGB grid (row-major). Negative scale mirrors horizontally. */
export function rasterTextToGrid(grid: Float32Array, opts: TextRasterOptions): void {
  const {
    text,
    width,
    height,
    anchorX,
    anchorY,
    scale,
    align,
    r,
    g,
    b,
    strokeSize,
    background,
    scroll,
    spacing
  } = opts
  const stroke = Math.max(0, Math.floor(strokeSize))
  const metrics = textMetrics(text, scale)
  const { totalW } = metrics

  fillBackground(grid, width, height, background)
  if (totalW <= 0) return

  const startX = alignedStartX(anchorX, totalW, align)

  if (!opts.tiled) {
    paintGlyphs(grid, width, height, startX, anchorY, metrics, r, g, b, stroke)
    return
  }

  const tileW = Math.max(1, totalW + Math.max(0, spacing))
  const stripW = Math.max(1, Math.ceil(totalW + stroke * 2))
  const strip = new Float32Array(stripW * height * 3)
  fillBackground(strip, stripW, height, background)
  paintGlyphs(strip, stripW, height, stroke, anchorY, metrics, r, g, b, stroke)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tileX = modPos(x - startX + scroll, tileW)
      const gi = (y * width + x) * 3
      if (tileX >= totalW) continue
      const sx = Math.min(stripW - 1, Math.floor(tileX + stroke))
      const si = (y * stripW + sx) * 3
      grid[gi] = strip[si] as number
      grid[gi + 1] = strip[si + 1] as number
      grid[gi + 2] = strip[si + 2] as number
    }
  }
}

/** Map a logical grid back to patch pixels using scope-aware cell coordinates. */
export function gridToScopedPixels(
  grid: Float32Array,
  out: Float32Array,
  positions: Float32Array,
  scope: GeneratorScope,
  bounds?: ScopeBounds
): void {
  const width = Math.max(1, Math.floor(scope.resolution.width))
  const b = scope.fullPatch ? undefined : (bounds ?? scopeBounds(positions, scope))
  for (let i = 0; i < scope.count; i++) {
    const patchIdx = scope.indices[i] as number
    const { cellX, cellY } = scopeCellCoord(positions, patchIdx, scope, b)
    const gi = (cellY * width + cellX) * 3
    const pi = patchIdx * 3
    out[pi] = grid[gi] as number
    out[pi + 1] = grid[gi + 1] as number
    out[pi + 2] = grid[gi + 2] as number
  }
}
