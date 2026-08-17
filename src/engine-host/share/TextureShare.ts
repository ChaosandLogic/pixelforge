import { createRequire } from 'node:module'
import type { GraphData } from '@shared/graph/types'
import { SYPHON_IN_NODE_TYPE, syphonSenderName } from '@shared/graph/nodes/generators/SyphonIn'
import {
  SYPHON_OUT_NODE_TYPE,
  isSyphonOutTransmitEnabled,
  syphonOutMapping,
  syphonOutName,
  syphonOutSize
} from '@shared/graph/nodes/output/SyphonOut'
import { clampShareSize, layoutToBgra, samplePackedToRgb, sampleSizeFor, streamToBgra } from '@shared/share/frame'
import type { Evaluator } from '../evaluator/Evaluator'

export type SharePlatform = 'syphon' | 'spout' | 'none'

export interface ShareStatus {
  available: boolean
  platform: SharePlatform
  senders: string[]
  error: string | null
}

interface ReceivedFrame {
  data: Buffer
  width: number
  height: number
}

interface TextureReceiverHandle {
  receiveFrame(): ReceivedFrame | null
  stop(): void
}

interface TextureSenderHandle {
  sendRgbaBuffer(data: Buffer, width: number, height: number): void
  stop(): void
}

interface NativeShare {
  TextureReceiver: new (senderName: string) => TextureReceiverHandle
  TextureSender: new (name: string, width: number, height: number) => TextureSenderHandle
  listSenders: () => Array<{ name: string }>
  getPlatform: () => string
}

function loadNative(): NativeShare | null {
  if (process.platform !== 'darwin' && process.platform !== 'win32') return null
  try {
    const require = createRequire(import.meta.url)
    return require('@napolab/texture-bridge-core') as NativeShare
  } catch (err) {
    console.warn('[share] native module unavailable:', err instanceof Error ? err.message : err)
    return null
  }
}

function platformFromNative(native: NativeShare | null): SharePlatform {
  if (native === null) return 'none'
  try {
    const name = native.getPlatform().toLowerCase()
    if (name.includes('spout')) return 'spout'
    if (name.includes('syphon')) return 'syphon'
  } catch {
    /* ignore */
  }
  if (process.platform === 'win32') return 'spout'
  if (process.platform === 'darwin') return 'syphon'
  return 'none'
}

/**
 * Syphon (macOS) / Spout (Windows) I/O for the engine host.
 * Uses the native CPU readback / RGBA upload path so it works headless.
 */
export class TextureShare {
  private readonly native: NativeShare | null
  private readonly receivers = new Map<string, { name: string; handle: TextureReceiverHandle }>()
  private readonly senders = new Map<string, { name: string; width: number; height: number; handle: TextureSenderHandle }>()
  readonly status: ShareStatus

  constructor() {
    this.native = loadNative()
    const platform = platformFromNative(this.native)
    let error: string | null = null
    if (process.platform !== 'darwin' && process.platform !== 'win32') {
      error = 'Syphon/Spout is not available on this platform'
    } else if (this.native === null) {
      error = 'Syphon/Spout native module failed to load'
    }
    this.status = {
      available: this.native !== null,
      platform,
      senders: [],
      error
    }
  }

  pollDiscovery(): void {
    if (this.native === null) return
    try {
      this.status.senders = this.native.listSenders().map((s) => s.name)
      this.status.error = null
    } catch (err) {
      this.status.error = err instanceof Error ? err.message : String(err)
    }
  }

  syncGraph(graph: GraphData | null, evaluator: Evaluator): void {
    this.syncReceivers(graph, evaluator)
    this.syncSenders(graph)
  }

  receive(evaluator: Evaluator, graph: GraphData | null): void {
    if (this.native === null || graph === null) return
    for (const node of graph.nodes) {
      if (node.type !== SYPHON_IN_NODE_TYPE) continue
      const entry = this.receivers.get(node.id)
      if (entry === undefined) continue
      try {
        const frame = entry.handle.receiveFrame()
        if (frame === null || frame.width <= 0 || frame.height <= 0) continue
        const { width, height } = sampleSizeFor(frame.width, frame.height)
        const rgb = samplePackedToRgb(frame.data, frame.width, frame.height, width, height, false)
        evaluator.setMediaFrame(node.id, width, height, rgb)
      } catch (err) {
        this.status.error = err instanceof Error ? err.message : String(err)
      }
    }
  }

  publish(evaluator: Evaluator, graph: GraphData | null): void {
    if (this.native === null || graph === null) return
    for (const node of graph.nodes) {
      if (node.type !== SYPHON_OUT_NODE_TYPE) continue
      if (!isSyphonOutTransmitEnabled(node.params)) continue
      const entry = this.senders.get(node.id)
      if (entry === undefined) continue
      const pixels = evaluator.getWiredPixels(node.id, 'pixels')
      if (pixels === null) continue
      const { width, height } = syphonOutSize(node.params)
      const mapping = syphonOutMapping(node.params)
      const buf =
        mapping === 'layout'
          ? layoutToBgra(pixels, evaluator.getPositions(), evaluator.getPixelCount(), width, height)
          : streamToBgra(
              pixels,
              evaluator.getResolution().width,
              evaluator.getResolution().height,
              width,
              height
            )
      try {
        entry.handle.sendRgbaBuffer(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength), width, height)
      } catch (err) {
        this.status.error = err instanceof Error ? err.message : String(err)
      }
    }
  }

  dispose(): void {
    for (const entry of this.receivers.values()) entry.handle.stop()
    for (const entry of this.senders.values()) entry.handle.stop()
    this.receivers.clear()
    this.senders.clear()
  }

  private syncReceivers(graph: GraphData | null, evaluator: Evaluator): void {
    const wanted = new Map<string, string>()
    if (graph !== null && this.native !== null) {
      for (const node of graph.nodes) {
        if (node.type !== SYPHON_IN_NODE_TYPE) continue
        const name = syphonSenderName(node.params)
        if (name !== '') wanted.set(node.id, name)
      }
    }

    for (const [id, entry] of this.receivers) {
      if (wanted.get(id) !== entry.name) {
        entry.handle.stop()
        this.receivers.delete(id)
        evaluator.setMediaFrame(id, 0, 0, new Uint8Array(0))
      }
    }

    if (this.native === null) return
    for (const [id, name] of wanted) {
      if (this.receivers.has(id)) continue
      try {
        this.receivers.set(id, { name, handle: new this.native.TextureReceiver(name) })
      } catch (err) {
        this.status.error = err instanceof Error ? err.message : String(err)
      }
    }
  }

  private syncSenders(graph: GraphData | null): void {
    const wanted = new Map<string, { name: string; width: number; height: number }>()
    if (graph !== null && this.native !== null) {
      for (const node of graph.nodes) {
        if (node.type !== SYPHON_OUT_NODE_TYPE) continue
        if (!isSyphonOutTransmitEnabled(node.params)) continue
        const size = syphonOutSize(node.params)
        wanted.set(node.id, {
          name: syphonOutName(node.params),
          width: clampShareSize(size.width, 256),
          height: clampShareSize(size.height, 256)
        })
      }
    }

    for (const [id, entry] of this.senders) {
      const next = wanted.get(id)
      if (
        next === undefined ||
        next.name !== entry.name ||
        next.width !== entry.width ||
        next.height !== entry.height
      ) {
        entry.handle.stop()
        this.senders.delete(id)
      }
    }

    if (this.native === null) return
    for (const [id, spec] of wanted) {
      if (this.senders.has(id)) continue
      try {
        this.senders.set(id, {
          ...spec,
          handle: new this.native.TextureSender(spec.name, spec.width, spec.height)
        })
      } catch (err) {
        this.status.error = err instanceof Error ? err.message : String(err)
      }
    }
  }
}
