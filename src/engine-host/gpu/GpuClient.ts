import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { GPU_PREVIEW_SIZE, type GpuCompileRequest, type GpuFrameRequest, type GpuHelloOk } from '@shared/gpu/protocol'
import { encodeGpuMessage, readGpuMessage, writeExact } from './ipc'

export interface GpuFrameResult {
  error: string | null
  samples: Map<string, Float32Array>
  previews: Map<string, { data: Uint8Array; width: number; height: number }>
  shareSenders: string[]
  shareError: string | null
}

/**
 * Blocking stdin/stdout client for gpu-engine. evaluate() stays synchronous:
 * one GPU frame is a short pipe round-trip.
 */
export class GpuClient {
  private proc: ChildProcessWithoutNullStreams | null = null
  private nextId = 1
  private onExit: (() => void) | null = null
  private stopping = false
  hello: GpuHelloOk | null = null
  lastError: string | null = null

  constructor(
    private readonly binaryPath: string,
    onExit?: () => void
  ) {
    this.onExit = onExit ?? null
  }

  get available(): boolean {
    return this.proc !== null && this.hello?.gpu === true
  }

  start(): boolean {
    if (this.proc !== null) return this.available
    this.stopping = false
    try {
      const syphonFramework = syphonFrameworkPath()
      const proc = spawn(this.binaryPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...(syphonFramework !== undefined ? { PIXELFORGE_SYPHON_FRAMEWORK: syphonFramework } : {})
        }
      })
      proc.stdout.pause()
      proc.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8').trim()
        if (text !== '') console.error(`[gpu-engine] ${text}`)
      })
      proc.on('exit', (code) => {
        const unexpected = !this.stopping
        this.proc = null
        this.hello = null
        if (!unexpected) return
        console.error(`[gpu-engine] exited with code ${code}`)
        this.onExit?.()
      })
      this.proc = proc
      const res = this.request({ kind: 'hello' }) as { kind?: string; body?: GpuHelloOk }
      if (res.kind === 'hello-ok' && res.body?.gpu === true) {
        this.hello = res.body
        this.lastError = res.body.error
        return true
      }
      this.lastError = res.body?.error ?? 'gpu hello failed'
      this.stop()
      return false
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err)
      this.stop()
      return false
    }
  }

  stop(): void {
    this.stopping = true
    const proc = this.proc
    this.proc = null
    this.hello = null
    if (proc === null) return
    try {
      this.write({ kind: 'shutdown' })
    } catch {
      /* ignore */
    }
    proc.kill()
  }

  listSenders(): string[] {
    if (!this.available) return []
    try {
      const res = this.request({ kind: 'senders' }) as { kind?: string; body?: { senders?: string[] } }
      return res.kind === 'senders-ok' ? (res.body?.senders ?? []) : []
    } catch {
      return []
    }
  }

  compile(body: GpuCompileRequest, positions: Float32Array): void {
    const blobs = new Map<string, Buffer>([['positions', Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength)]])
    const res = this.request({ kind: 'compile', body }, blobs) as { kind?: string; error?: string }
    if (res.kind !== 'compile-ok') {
      throw new Error(res.error ?? 'gpu compile failed')
    }
  }

  frame(body: GpuFrameRequest, uploads: Map<string, { width: number; height: number; rgb: Float32Array }>): GpuFrameResult {
    const blobs = new Map<string, Buffer>()
    for (const [id, upload] of uploads) {
      blobs.set(`upload:${id}`, Buffer.from(upload.rgb.buffer, upload.rgb.byteOffset, upload.rgb.byteLength))
    }
    const msg = this.requestRaw({ kind: 'frame', body }, blobs)
    const header = msg.header as {
      kind?: string
      error?: string
      body?: {
        error: string | null
        shareSenders: string[]
        shareError: string | null
        sampleIds: string[]
        previews: Array<{ nodeId: string; width: number; height: number }>
      }
    }
    if (header.kind !== 'frame-ok' || header.body === undefined) {
      throw new Error(header.error ?? 'gpu frame failed')
    }
    const samples = new Map<string, Float32Array>()
    for (const [name, buf] of msg.blobs) {
      if (name.startsWith('sample:')) {
        samples.set(name.slice('sample:'.length), new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4))
      }
    }
    const previews = new Map<string, { data: Uint8Array; width: number; height: number }>()
    for (const [name, buf] of msg.blobs) {
      if (name.startsWith('preview:')) {
        previews.set(name.slice('preview:'.length), {
          data: new Uint8Array(buf),
          width: GPU_PREVIEW_SIZE,
          height: GPU_PREVIEW_SIZE
        })
      }
    }
    return {
      error: header.body.error,
      samples,
      previews,
      shareSenders: header.body.shareSenders,
      shareError: header.body.shareError
    }
  }

  private request(header: Record<string, unknown>, blobs?: Map<string, Buffer>): unknown {
    return this.requestRaw(header, blobs).header
  }

  private requestRaw(header: Record<string, unknown>, blobs?: Map<string, Buffer>): ReturnType<typeof readGpuMessage> {
    const proc = this.proc
    if (proc === null || proc.stdin.writableEnded) throw new Error('gpu-engine is not running')
    const id = this.nextId++
    const packed = encodeGpuMessage({ id, ...header }, blobs ?? new Map())
    writeExact(stdioFd(proc.stdin), packed)
    return readGpuMessage(stdioFd(proc.stdout))
  }

  private write(header: Record<string, unknown>): void {
    const proc = this.proc
    if (proc === null) return
    const packed = encodeGpuMessage({ id: this.nextId++, ...header })
    writeExact(stdioFd(proc.stdin), packed)
  }
}

function stdioFd(stream: unknown): number {
  const s = stream as { fd?: number; _handle?: { fd?: number } }
  const fd = s.fd ?? s._handle?.fd
  if (typeof fd !== 'number') throw new Error('gpu-engine stdio has no fd')
  return fd
}

function syphonFrameworkPath(): string | undefined {
  if (process.platform !== 'darwin') return undefined
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  try {
    const require = createRequire(import.meta.url)
    const pkg = dirname(require.resolve(`@napolab/texture-bridge-darwin-${arch}/package.json`))
    const framework = join(pkg, 'Syphon.framework')
    if (existsSync(framework)) return framework
  } catch {
    /* optional */
  }
  return undefined
}
