import { useEffect, useRef } from 'react'
import { useEngineStore } from '@/store/engineStore'

/**
 * 2D preview: renders the live pixel buffer as a grid of cells. This is the
 * Milestone 1 stand-in for the 3D visualiser — it reads the same frame
 * stream the visualiser will use.
 */
export function CanvasPreview(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return

    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    let raf = 0

    const draw = (): void => {
      const { frame, framePixelCount } = useEngineStore.getState()
      const { clientWidth, clientHeight } = canvas
      const dpr = window.devicePixelRatio
      if (canvas.width !== clientWidth * dpr || canvas.height !== clientHeight * dpr) {
        canvas.width = clientWidth * dpr
        canvas.height = clientHeight * dpr
      }

      ctx.fillStyle = '#0a0d12'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (frame !== null && framePixelCount > 0) {
        const aspect = canvas.width / canvas.height
        const cols = Math.max(1, Math.ceil(Math.sqrt(framePixelCount * aspect)))
        const rows = Math.ceil(framePixelCount / cols)
        const cellW = canvas.width / cols
        const cellH = canvas.height / rows
        // Rounded cells with gaps get too expensive past ~2k pixels.
        const fancy = framePixelCount <= 2000
        const gap = fancy ? Math.min(cellW, cellH) * 0.15 : 0

        for (let i = 0; i < framePixelCount; i++) {
          const r = frame[i * 3] ?? 0
          const g = frame[i * 3 + 1] ?? 0
          const b = frame[i * 3 + 2] ?? 0
          const x = (i % cols) * cellW
          const y = Math.floor(i / cols) * cellH
          ctx.fillStyle = `rgb(${r},${g},${b})`
          if (fancy) {
            ctx.beginPath()
            ctx.roundRect(x + gap / 2, y + gap / 2, cellW - gap, cellH - gap, gap)
            ctx.fill()
          } else {
            ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5)
          }
        }
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="preview-wrap">
      <canvas ref={canvasRef} className="preview-canvas" />
    </div>
  )
}
