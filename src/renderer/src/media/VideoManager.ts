import type { NodePreview } from '@shared/messages'
import { NODE_PREVIEW_SIZE } from '@shared/preview/displaySize'
import { usePatchStore } from '@/store/patchStore'
import { useGraphStore, type PfNode } from '@/store/graphStore'

/**
 * Owns hidden <video> elements for VideoFile node thumbnails in the editor.
 * Engine sampling is done by the GPU sidecar.
 */

const VIDEO_NODE_TYPE = 'generator/video'
const MAX_SAMPLE = 128
const SAMPLE_FPS = 30

interface VideoEntry {
  path: string
  video: HTMLVideoElement
  url: string | null
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  previewCanvas: HTMLCanvasElement
  previewCtx: CanvasRenderingContext2D
  previewRgb: Uint8Array
  previewWidth: number
  previewHeight: number
  disposed: boolean
}

const entries = new Map<string, VideoEntry>()
const urlCache = new Map<string, Promise<string>>()
const pathRefs = new Map<string, number>()

function mimeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'webm':
      return 'video/webm'
    case 'mov':
    case 'm4v':
    case 'mp4':
    default:
      return 'video/mp4'
  }
}

function retainPath(path: string): void {
  pathRefs.set(path, (pathRefs.get(path) ?? 0) + 1)
}

function releasePath(path: string): void {
  const next = (pathRefs.get(path) ?? 1) - 1
  if (next > 0) {
    pathRefs.set(path, next)
    return
  }
  pathRefs.delete(path)
  const cached = urlCache.get(path)
  urlCache.delete(path)
  if (cached !== undefined) {
    void cached.then((url) => URL.revokeObjectURL(url)).catch(() => {})
  }
}

async function loadObjectUrl(path: string): Promise<string> {
  retainPath(path)
  let cached = urlCache.get(path)
  if (cached === undefined) {
    cached = window.pixelforge.readMediaFile(path).then((bytes) => {
      return URL.createObjectURL(new Blob([bytes], { type: mimeFor(path) }))
    })
    urlCache.set(path, cached)
  }
  return cached
}

function sampleDimensions(): { width: number; height: number } {
  const { resolution } = usePatchStore.getState()
  return {
    width: Math.max(1, Math.min(MAX_SAMPLE, resolution.width)),
    height: Math.max(1, Math.min(MAX_SAMPLE, resolution.height))
  }
}

/** Letterbox video into the standard square node preview. */
function drawVideoPreview(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  videoW: number,
  videoH: number
): void {
  const size = NODE_PREVIEW_SIZE
  ctx.fillStyle = '#0a0d12'
  ctx.fillRect(0, 0, size, size)
  if (videoW <= 0 || videoH <= 0) return

  const scale = Math.min(size / videoW, size / videoH)
  const dw = Math.max(1, Math.round(videoW * scale))
  const dh = Math.max(1, Math.round(videoH * scale))
  const dx = Math.floor((size - dw) / 2)
  const dy = Math.floor((size - dh) / 2)
  ctx.drawImage(video, 0, 0, videoW, videoH, dx, dy, dw, dh)
}

function createEntry(nodeId: string, path: string): VideoEntry {
  const video = document.createElement('video')
  video.muted = true
  video.loop = true
  video.playsInline = true

  const { width, height } = sampleDimensions()
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (ctx === null) throw new Error('2d context unavailable')

  const previewCanvas = document.createElement('canvas')
  previewCanvas.width = 1
  previewCanvas.height = 1
  const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true })
  if (previewCtx === null) throw new Error('2d context unavailable')

  const entry: VideoEntry = {
    path,
    video,
    url: null,
    canvas,
    ctx,
    previewCanvas,
    previewCtx,
    previewRgb: new Uint8Array(3),
    previewWidth: 1,
    previewHeight: 1,
    disposed: false
  }

  void loadObjectUrl(path).then((url) => {
    if (entry.disposed) return
    entry.url = url
    video.src = url
    void video.play().catch((err: unknown) => {
      console.error(`[video] playback failed for node ${nodeId}:`, err)
    })
  })

  return entry
}

function disposeEntry(entry: VideoEntry): void {
  entry.disposed = true
  entry.video.pause()
  entry.video.removeAttribute('src')
  entry.video.load()
  entry.url = null
  releasePath(entry.path)
}

function syncEntries(nodes: PfNode[]): void {
  const wanted = new Map<string, string>()
  for (const n of nodes) {
    if (n.data.nodeType !== VIDEO_NODE_TYPE) continue
    const file = n.data.params['file']
    if (typeof file === 'string' && file !== '') wanted.set(n.id, file)
  }

  for (const [nodeId, entry] of entries) {
    if (wanted.get(nodeId) !== entry.path) {
      disposeEntry(entry)
      entries.delete(nodeId)
    }
  }
  for (const [nodeId, path] of wanted) {
    if (!entries.has(nodeId)) entries.set(nodeId, createEntry(nodeId, path))
  }
}

function resizeEngineCanvases(): void {
  const { width, height } = sampleDimensions()
  for (const entry of entries.values()) {
    entry.canvas.width = width
    entry.canvas.height = height
  }
}

function sampleAll(): void {
  const { width, height } = sampleDimensions()
  for (const entry of entries.values()) {
    const { video, ctx, canvas, previewCtx, previewCanvas } = entry
    if (video.readyState < 2 || video.videoWidth === 0) continue

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, width, height)

    const pw = NODE_PREVIEW_SIZE
    const ph = NODE_PREVIEW_SIZE
    if (previewCanvas.width !== pw || previewCanvas.height !== ph) {
      previewCanvas.width = pw
      previewCanvas.height = ph
      entry.previewRgb = new Uint8Array(pw * ph * 3)
    }
    drawVideoPreview(previewCtx, video, video.videoWidth, video.videoHeight)
    const previewRgba = previewCtx.getImageData(0, 0, pw, ph).data
    for (let i = 0; i < pw * ph; i++) {
      entry.previewRgb[i * 3] = previewRgba[i * 4] ?? 0
      entry.previewRgb[i * 3 + 1] = previewRgba[i * 4 + 1] ?? 0
      entry.previewRgb[i * 3 + 2] = previewRgba[i * 4 + 2] ?? 0
    }
    entry.previewWidth = pw
    entry.previewHeight = ph
  }
}

/** Full-resolution preview frame for node thumbnails (renderer-local). */
export function getVideoPreviewFrame(nodeId: string): Extract<NodePreview, { kind: 'pixels' }> | null {
  const entry = entries.get(nodeId)
  if (entry === undefined || entry.previewWidth <= 0 || entry.previewHeight <= 0) return null
  return {
    kind: 'pixels',
    data: entry.previewRgb,
    width: entry.previewWidth,
    height: entry.previewHeight
  }
}

export function initVideoManager(): void {
  syncEntries(useGraphStore.getState().nodes)
  useGraphStore.subscribe((state) => syncEntries(state.nodes))
  usePatchStore.subscribe(() => resizeEngineCanvases())
  setInterval(sampleAll, 1000 / SAMPLE_FPS)
}
