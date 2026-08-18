import { IMAGE_NODE_TYPE } from '@shared/graph/nodes/generators/ImageFile'
import { useGraphStore, type PfNode } from '@/store/graphStore'

/** Loads still images for Image node UI; engine decode is in the GPU sidecar. */

const MAX_SAMPLE = 128

interface ImageEntry {
  path: string
  width: number
  height: number
  rgb: Uint8Array
  disposed: boolean
}

const entries = new Map<string, ImageEntry>()
const urlCache = new Map<string, Promise<string>>()
/** nodeId → path of in-flight load; stale completions are discarded */
const pendingPaths = new Map<string, string>()
const pathRefs = new Map<string, number>()

function mimeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'bmp':
      return 'image/bmp'
    default:
      return 'image/jpeg'
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

async function decodeImage(nodeId: string, path: string): Promise<ImageEntry | null> {
  try {
    const url = await loadObjectUrl(path)
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Image decode failed'))
      img.src = url
    })

    const scale = Math.min(1, MAX_SAMPLE / Math.max(img.width, img.height))
    const width = Math.max(1, Math.round(img.width * scale))
    const height = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx === null) return null
    ctx.drawImage(img, 0, 0, width, height)
    const rgba = ctx.getImageData(0, 0, width, height).data
    const rgb = new Uint8Array(width * height * 3)
    for (let i = 0; i < width * height; i++) {
      rgb[i * 3] = rgba[i * 4] ?? 0
      rgb[i * 3 + 1] = rgba[i * 4 + 1] ?? 0
      rgb[i * 3 + 2] = rgba[i * 4 + 2] ?? 0
    }
    return { path, width, height, rgb, disposed: false }
  } catch (err: unknown) {
    releasePath(path)
    console.error(`[image] load failed for node ${nodeId}:`, err)
    return null
  }
}

function syncEntries(nodes: PfNode[]): void {
  const wanted = new Map<string, string>()
  for (const n of nodes) {
    if (n.data.nodeType !== IMAGE_NODE_TYPE) continue
    const file = n.data.params['file']
    if (typeof file === 'string' && file !== '') wanted.set(n.id, file)
  }

  for (const [nodeId, entry] of entries) {
    if (wanted.get(nodeId) !== entry.path) {
      releasePath(entry.path)
      entries.delete(nodeId)
      pendingPaths.delete(nodeId)
    }
  }

  for (const [nodeId, path] of wanted) {
    const existing = entries.get(nodeId)
    if (existing !== undefined && existing.path === path) continue
    pendingPaths.set(nodeId, path)
    void decodeImage(nodeId, path).then((entry) => {
      if (pendingPaths.get(nodeId) !== path) {
        releasePath(path)
        return
      }
      pendingPaths.delete(nodeId)
      if (entry === null || entry.disposed) return
      entries.set(nodeId, entry)
    })
  }
}

export function initImageManager(): void {
  syncEntries(useGraphStore.getState().nodes)
  useGraphStore.subscribe((state) => syncEntries(state.nodes))
}
