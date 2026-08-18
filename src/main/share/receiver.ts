import { createRequire } from 'node:module'
import type { RendererToEngine } from '@shared/messages'
import { samplePackedToRgb, sampleSizeFor } from '@shared/share/frame'
import {
  parseShareSender,
  shareSenderLabel,
  type ShareInputSub,
  type ShareSenderInfo
} from '@shared/share/senders'

interface ReceivedFrame {
  data: Buffer
  width: number
  height: number
}

interface TextureReceiverHandle {
  receiveFrame(): ReceivedFrame | null
  stop(): void
}

interface NativeShare {
  TextureReceiver: new (senderName: string, appName?: string | null, uuid?: string | null) => TextureReceiverHandle
  listSenders?: () => ShareSenderInfo[]
}

function loadNative(): NativeShare | null {
  if (process.platform !== 'darwin' && process.platform !== 'win32') return null
  try {
    const require = createRequire(import.meta.url)
    return require('@napolab/texture-bridge') as NativeShare
  } catch (err) {
    console.warn('[share] receiver native module unavailable:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Receives Syphon/Spout in the Electron main process (Cocoa run loop) and
 * forwards RGB frames to the engine host.
 */
export class ShareReceiverHub {
  private readonly native: NativeShare | null
  private readonly send: (msg: RendererToEngine) => void
  private readonly receivers = new Map<string, { sender: string; handle: TextureReceiverHandle }>()
  private timer: ReturnType<typeof setInterval> | null = null
  private lastInputs: ShareInputSub[] = []

  constructor(send: (msg: RendererToEngine) => void) {
    this.native = loadNative()
    this.send = send
  }

  setInputs(inputs: ShareInputSub[]): void {
    this.lastInputs = inputs
    if (this.native === null) return
    const wanted = new Map(inputs.map((item) => [item.nodeId, item.sender]))
    for (const [id, entry] of this.receivers) {
      if (wanted.get(id) !== entry.sender) {
        entry.handle.stop()
        this.receivers.delete(id)
      }
    }
    for (const [id, sender] of wanted) {
      if (this.receivers.has(id)) continue
      try {
        this.receivers.set(id, { sender, handle: this.createReceiver(sender) })
      } catch (err) {
        console.warn('[share] receiver failed:', err instanceof Error ? err.message : err)
      }
    }
    if (this.receivers.size === 0) {
      this.stopTimer()
      return
    }
    this.startTimer()
  }

  restore(): void {
    this.setInputs(this.lastInputs)
  }

  dispose(): void {
    this.stopTimer()
    for (const entry of this.receivers.values()) entry.handle.stop()
    this.receivers.clear()
  }

  private createReceiver(sender: string): TextureReceiverHandle {
    const native = this.native
    if (native === null) throw new Error('Syphon/Spout native module unavailable')
    const listed = native.listSenders?.() ?? []
    const info = listed.find((item) => shareSenderLabel(item) === sender)
    if (info !== undefined) {
      return new native.TextureReceiver(info.name ?? sender, info.appName, info.uuid)
    }
    const parsed = parseShareSender(sender)
    return new native.TextureReceiver(parsed.name || sender, parsed.appName)
  }

  private startTimer(): void {
    if (this.timer !== null) return
    this.timer = setInterval(() => this.tick(), 33)
  }

  private stopTimer(): void {
    if (this.timer === null) return
    clearInterval(this.timer)
    this.timer = null
  }

  private tick(): void {
    for (const [nodeId, entry] of this.receivers) {
      try {
        const frame = entry.handle.receiveFrame()
        if (frame === null || frame.width <= 0 || frame.height <= 0) continue
        const { width, height } = sampleSizeFor(frame.width, frame.height)
        const data = samplePackedToRgb(frame.data, frame.width, frame.height, width, height, false)
        this.send({ type: 'media-frame', nodeId, width, height, data })
      } catch (err) {
        console.warn('[share] receiveFrame failed:', err instanceof Error ? err.message : err)
      }
    }
  }
}
