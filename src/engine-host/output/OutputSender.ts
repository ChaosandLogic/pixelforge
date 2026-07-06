import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import type { OutputProtocolKind } from '@shared/output/config'
import type { FromOutputWorker, OutputWorkerConfigure, ToOutputWorker } from './workerMessages'

export type OutputConfigureMessage = Omit<OutputWorkerConfigure, 'type'>

/**
 * Coordinator for the output worker thread. Owns the worker lifecycle and
 * relays config; the worker reads pixel data straight from the
 * SharedArrayBuffer on its own tick.
 */
export class OutputSender {
  private readonly worker: Worker
  packetsPerSec = 0
  lastError: string | null = null
  protocolName = 'sACN'
  enabled = false

  constructor(
    sab: SharedArrayBuffer,
    control: SharedArrayBuffer,
    onStats?: (msg: FromOutputWorker) => void
  ) {
    this.worker = new Worker(join(__dirname, 'outputWorker.js'), {
      workerData: { sab, control }
    })
    this.worker.on('message', (msg: FromOutputWorker) => {
      if (msg.type === 'stats') {
        this.packetsPerSec = msg.packetsPerSec
        this.lastError = msg.lastError
        this.protocolName = msg.protocolName
        onStats?.(msg)
      }
    })
    this.worker.on('error', (err: Error) => {
      this.lastError = err.message
    })
  }

  configure(msg: OutputConfigureMessage): void {
    this.post({ type: 'configure', ...msg })
  }

  enable(): void {
    this.enabled = true
    this.post({ type: 'enable' })
  }

  disable(): void {
    this.enabled = false
    this.post({ type: 'disable' })
  }

  shutdown(): void {
    this.post({ type: 'shutdown' })
  }

  private post(msg: ToOutputWorker): void {
    this.worker.postMessage(msg)
  }
}

export type { OutputProtocolKind }
