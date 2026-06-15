import { useEffect, useRef } from 'react'
import type { NodePreview as NodePreviewData } from '@shared/messages'
import { previewDisplaySize } from '@shared/preview/displaySize'
import { nodePreviewView } from '@shared/graph/preview'
import { getVideoPreviewFrame } from '@/media/VideoManager'
import { useEngineStore } from '@/store/engineStore'
import { useGraphStore } from '@/store/graphStore'

const VIDEO_NODE_TYPE = 'generator/video'

interface OffscreenCache {
  canvas: HTMLCanvasElement
  w: number
  h: number
}

function drawPixels(
  ctx: CanvasRenderingContext2D,
  preview: { width: number; height: number; data: Uint8Array },
  canvasW: number,
  canvasH: number,
  offscreen: OffscreenCache | null
): OffscreenCache | null {
  const { width, height, data } = preview
  let cache = offscreen
  if (cache === null || cache.w !== width || cache.h !== height) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    cache = { canvas, w: width, h: height }
  }

  const offCtx = cache.canvas.getContext('2d')
  if (offCtx === null) return cache

  const imageData = offCtx.createImageData(width, height)
  const rgba = imageData.data
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = data[i * 3] ?? 0
    rgba[i * 4 + 1] = data[i * 3 + 1] ?? 0
    rgba[i * 4 + 2] = data[i * 3 + 2] ?? 0
    rgba[i * 4 + 3] = 255
  }
  offCtx.putImageData(imageData, 0, 0)

  ctx.fillStyle = '#0a0d12'
  ctx.fillRect(0, 0, canvasW, canvasH)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(cache.canvas, 0, 0, canvasW, canvasH)
  return cache
}

/**
 * Live output thumbnail at NODE_PREVIEW_SIZE (scaled to fit the node card).
 * Video nodes read the decoded frame directly from VideoManager.
 */
export function NodePreview({
  nodeId,
  nodeType,
  kind
}: {
  nodeId: string
  nodeType: string
  kind: 'pixels' | 'float'
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<OffscreenCache | null>(null)
  const previewView = useGraphStore((s) =>
    nodePreviewView(s.nodes.find((n) => n.id === nodeId)?.data.previewView)
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    let raf = 0

    const draw = (): void => {
      let pixelPreview: Extract<NodePreviewData, { kind: 'pixels' }> | null = null

      if (nodeType === VIDEO_NODE_TYPE) {
        pixelPreview = getVideoPreviewFrame(nodeId)
      }
      if (pixelPreview === null) {
        const preview = useEngineStore.getState().previews[nodeId]
        if (preview?.kind === 'pixels') pixelPreview = preview
      }

      if (kind === 'pixels' && pixelPreview !== null) {
        const enginePreview = useEngineStore.getState().previews[nodeId]
        const layoutPreview =
          previewView === 'output' &&
          enginePreview?.kind === 'pixels' &&
          enginePreview.layout !== undefined
            ? {
                width: enginePreview.layout.width,
                height: enginePreview.layout.height,
                data: enginePreview.layout.data
              }
            : null
        const raster = layoutPreview ?? pixelPreview
        const { w, h } = previewDisplaySize()
        const dpr = window.devicePixelRatio || 1
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr
          canvas.height = h * dpr
          canvas.style.width = `${w}px`
          canvas.style.height = `${h}px`
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        offscreenRef.current = drawPixels(ctx, raster, w, h, offscreenRef.current)
      } else if (kind === 'float') {
        const preview = useEngineStore.getState().previews[nodeId]
        const w = 168
        const h = 16
        const dpr = window.devicePixelRatio || 1
        canvas.width = w * dpr
        canvas.height = h * dpr
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.fillStyle = '#0a0d12'
        ctx.fillRect(0, 0, w, h)
        if (preview?.kind === 'float') {
          const v = preview.value
          const fill = Math.max(0, Math.min(1, v))
          ctx.fillStyle = 'rgba(80, 160, 255, 0.35)'
          ctx.fillRect(0, 0, fill * w, h)
          ctx.fillStyle = '#dde3ea'
          ctx.font = '9px ui-monospace, monospace'
          ctx.textAlign = 'right'
          ctx.textBaseline = 'middle'
          ctx.fillText(v.toFixed(2), w - 4, h / 2 + 0.5)
        }
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [nodeId, nodeType, kind, previewView])

  return (
    <div className="pf-preview-wrap">
      <canvas ref={canvasRef} className="pf-preview-canvas" />
    </div>
  )
}
