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
  imageData: ImageData | null
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
    cache = { canvas, w: width, h: height, imageData: null }
  }

  const offCtx = cache.canvas.getContext('2d')
  if (offCtx === null) return cache

  let imageData = cache.imageData
  if (imageData === null || imageData.width !== width || imageData.height !== height) {
    imageData = offCtx.createImageData(width, height)
    cache.imageData = imageData
  }
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

function pickPixelRaster(
  nodeId: string,
  nodeType: string,
  previewView: 'effect' | 'output',
  previews: Record<string, NodePreviewData>
): Extract<NodePreviewData, { kind: 'pixels' }> | null {
  if (nodeType === VIDEO_NODE_TYPE) {
    const frame = getVideoPreviewFrame(nodeId)
    if (frame !== null) return frame
  }
  const enginePreview = previews[nodeId]
  if (enginePreview?.kind !== 'pixels') return null
  if (
    previewView === 'output' &&
    enginePreview.layout !== undefined
  ) {
    return {
      kind: 'pixels',
      width: enginePreview.layout.width,
      height: enginePreview.layout.height,
      data: enginePreview.layout.data
    }
  }
  return enginePreview
}

/**
 * Live output thumbnail at NODE_PREVIEW_SIZE (scaled to fit the node card).
 * Redraws on engine preview updates; video nodes also poll each frame.
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
    let lastFloat = Number.NaN

    const drawPixelsPreview = (): void => {
      const raster = pickPixelRaster(
        nodeId,
        nodeType,
        previewView,
        useEngineStore.getState().previews
      )
      if (raster === null) return

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
    }

    const drawFloatPreview = (): void => {
      const preview = useEngineStore.getState().previews[nodeId]
      const w = 168
      const h = 16
      const v = preview?.kind === 'float' ? preview.value : Number.NaN
      if (v === lastFloat) return
      lastFloat = v

      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#0a0d12'
      ctx.fillRect(0, 0, w, h)
      if (preview?.kind === 'float') {
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

    const draw = (): void => {
      if (kind === 'pixels') drawPixelsPreview()
      else drawFloatPreview()
    }

    draw()

    const unsub = useEngineStore.subscribe((state, prev) => {
      if (state.previews[nodeId] === prev.previews[nodeId]) return
      draw()
    })

    const tick = (): void => {
      if (nodeType === VIDEO_NODE_TYPE && kind === 'pixels') drawPixelsPreview()
      raf = requestAnimationFrame(tick)
    }
    if (nodeType === VIDEO_NODE_TYPE && kind === 'pixels') {
      raf = requestAnimationFrame(tick)
    }

    return () => {
      unsub()
      cancelAnimationFrame(raf)
    }
  }, [nodeId, nodeType, kind, previewView])

  return (
    <div className="pf-preview-wrap">
      <canvas ref={canvasRef} className="pf-preview-canvas" />
    </div>
  )
}
