import { readFileSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'

// Scale icon artwork down and center it on a 1024 canvas with transparent
// squircle corners — matches macOS dock proportions (~76% glyph scale).
//
// Usage: node scripts/prepare-icon.mjs <in.png> <out.png> [scale] [radiusFraction]

const [, , inPath, outPath, scaleArg, radiusArg] = process.argv
if (!inPath || !outPath) {
  console.error(
    'Usage: node scripts/prepare-icon.mjs <in.png> <out.png> [scale] [radiusFraction]'
  )
  process.exit(1)
}

const CANVAS = 1024
const scale = scaleArg ? Number(scaleArg) : 0.76
const radiusFraction = radiusArg ? Number(radiusArg) : 0.195

function sampleBilinear(src, sx, sy) {
  const w = src.width
  const h = src.height
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(sx)))
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(sy)))
  const x1 = Math.min(w - 1, x0 + 1)
  const y1 = Math.min(h - 1, y0 + 1)
  const tx = sx - x0
  const ty = sy - y0

  const out = [0, 0, 0, 0]
  for (let c = 0; c < 4; c++) {
    const v00 = src.data[(y0 * w + x0) * 4 + c]
    const v10 = src.data[(y0 * w + x1) * 4 + c]
    const v01 = src.data[(y1 * w + x0) * 4 + c]
    const v11 = src.data[(y1 * w + x1) * 4 + c]
    const v0 = v00 * (1 - tx) + v10 * tx
    const v1 = v01 * (1 - tx) + v11 * tx
    out[c] = v0 * (1 - ty) + v1 * ty
  }
  return out
}

function scaleToCanvas(src, canvasSize, glyphScale) {
  const dst = new PNG({ width: canvasSize, height: canvasSize })
  dst.data.fill(0)

  const drawW = src.width * glyphScale
  const drawH = src.height * glyphScale
  const offsetX = (canvasSize - drawW) / 2
  const offsetY = (canvasSize - drawH) / 2

  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      const sx = ((x + 0.5 - offsetX) / drawW) * src.width - 0.5
      const sy = ((y + 0.5 - offsetY) / drawH) * src.height - 0.5
      if (sx < 0 || sy < 0 || sx > src.width - 1 || sy > src.height - 1) continue

      const [r, g, b, a] = sampleBilinear(src, sx, sy)
      const idx = (y * canvasSize + x) * 4
      dst.data[idx] = Math.round(r)
      dst.data[idx + 1] = Math.round(g)
      dst.data[idx + 2] = Math.round(b)
      dst.data[idx + 3] = Math.round(a)
    }
  }

  return dst
}

function applySquircleMask(png, radiusFrac) {
  const { width: w, height: h, data } = png
  const cx = w / 2
  const cy = h / 2
  const hx = w / 2
  const hy = h / 2
  const r = Math.min(w, h) * radiusFrac
  const feather = 1

  function sdRoundedRect(px, py) {
    const qx = Math.abs(px - cx) - (hx - r)
    const qy = Math.abs(py - cy) - (hy - r)
    const ax = Math.max(qx, 0)
    const ay = Math.max(qy, 0)
    const outside = Math.hypot(ax, ay)
    const inside = Math.min(Math.max(qx, qy), 0)
    return outside + inside - r
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = sdRoundedRect(x + 0.5, y + 0.5)
      let coverage = 0.5 - d / feather
      if (coverage < 0) coverage = 0
      else if (coverage > 1) coverage = 1
      const idx = (y * w + x) * 4
      data[idx + 3] = Math.round(data[idx + 3] * coverage)
    }
  }
}

const src = PNG.sync.read(readFileSync(inPath))
const out = scaleToCanvas(src, CANVAS, scale)
applySquircleMask(out, radiusFraction)
writeFileSync(outPath, PNG.sync.write(out))
console.log(`Wrote ${outPath} (${CANVAS}x${CANVAS}, scale ${scale}, radius ${radiusFraction})`)
