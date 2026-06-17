import { useEffect, useRef } from 'react'
import { generateFixturePoints, type Fixture } from '@shared/patch/layout'
import type { PatchPoint } from '@shared/patch/types'
import { useEngineStore } from '@/store/engineStore'
import { usePatchStore } from '@/store/patchStore'

const FIXTURE_COLORS = ['#4da3ff', '#ff6b4d', '#4dff91', '#c94dff', '#ffd24d', '#ff4da3']
const PATH_COLOR = 'rgba(140, 160, 190, 0.35)'
const BG = '#0a0d12'

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function computeBounds(points: PatchPoint[]): Bounds {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const padX = Math.max(0.1, (maxX - minX) * 0.1)
  const padY = Math.max(0.1, (maxY - minY) * 0.1)
  return { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY }
}

function drawLayout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  points: PatchPoint[],
  fixtures: Fixture[],
  frame: Uint8Array | null,
  pixelCount: number
): void {
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, w, h)

  if (points.length === 0) {
    ctx.fillStyle = '#6b7a8f'
    ctx.font = '13px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText('No patch points', w / 2, h / 2)
    return
  }

  const bounds = computeBounds(points)
  const rangeX = bounds.maxX - bounds.minX || 1
  const rangeY = bounds.maxY - bounds.minY || 1
  const margin = 20
  const scale = Math.min((w - margin * 2) / rangeX, (h - margin * 2) / rangeY)

  const toScreen = (x: number, y: number): { sx: number; sy: number } => ({
    sx: margin + (x - bounds.minX) * scale,
    sy: margin + (y - bounds.minY) * scale
  })

  const hasPixels = frame !== null && pixelCount > 0

  ctx.beginPath()
  ctx.strokeStyle = PATH_COLOR
  ctx.lineWidth = 1.5
  for (let i = 0; i < points.length; i++) {
    const p = points[i] as PatchPoint
    const { sx, sy } = toScreen(p.x, p.y)
    if (i === 0) ctx.moveTo(sx, sy)
    else ctx.lineTo(sx, sy)
  }
  ctx.stroke()

  const fixtureRanges: Array<{ start: number; end: number; color: string }> = []
  let offset = 0
  for (let fi = 0; fi < fixtures.length; fi++) {
    const count = generateFixturePoints(fixtures[fi] as Fixture).length
    fixtureRanges.push({
      start: offset,
      end: offset + count,
      color: FIXTURE_COLORS[fi % FIXTURE_COLORS.length] as string
    })
    offset += count
  }

  const fallbackColor = (idx: number): string => {
    for (const range of fixtureRanges) {
      if (idx >= range.start && idx < range.end) return range.color
    }
    return '#8b9cb3'
  }

  const dotR = Math.max(2, Math.min(5, scale * 0.35))

  for (let i = 0; i < points.length; i++) {
    const p = points[i] as PatchPoint
    const { sx, sy } = toScreen(p.x, p.y)

    if (hasPixels && i < pixelCount) {
      const r = frame[i * 3] ?? 0
      const g = frame[i * 3 + 1] ?? 0
      const b = frame[i * 3 + 2] ?? 0
      ctx.fillStyle = `rgb(${r},${g},${b})`
    } else {
      ctx.fillStyle = fallbackColor(i)
    }

    ctx.beginPath()
    ctx.arc(sx, sy, dotR, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 0.5
    ctx.stroke()
  }

  const first = points[0] as PatchPoint
  const start = toScreen(first.x, first.y)
  ctx.strokeStyle = '#4dff91'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(start.sx, start.sy, dotR + 5, 0, Math.PI * 2)
  ctx.stroke()
}

/**
 * Layout tab: patch geometry with live pixel colours mapped onto each point.
 */
export function LayoutDataPreview(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    let raf = 0

    const draw = (): void => {
      const { clientWidth, clientHeight } = canvas
      const dpr = window.devicePixelRatio
      const w = Math.max(1, Math.floor(clientWidth * dpr))
      const h = Math.max(1, Math.floor(clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      const { frame, framePixelCount } = useEngineStore.getState()
      const { points: pts, layout: lay } = usePatchStore.getState()
      drawLayout(ctx, canvas.clientWidth, canvas.clientHeight, pts, lay?.fixtures ?? [], frame, framePixelCount)
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="preview-wrap preview-wrap--layout">
      <canvas ref={canvasRef} className="preview-canvas" />
    </div>
  )
}
