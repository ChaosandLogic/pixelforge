import type { OutputProtocolConfig } from './OutputProtocol'

/** Messages between the engine host main thread and the output worker. */

export interface OutputWorkerData {
  sab: SharedArrayBuffer
  /**
   * One Int32 seqlock counter shared with the evaluator. The evaluator makes it
   * odd before writing pixels and even after; the worker only trusts a copy it
   * read while the counter was even and unchanged, so DMX frames are never torn.
   */
  control: SharedArrayBuffer
}

export type OutputWorkerConfigure = OutputProtocolConfig & {
  type: 'configure'
  pixelCount: number
  targetFps: number
}

export type ToOutputWorker =
  | OutputWorkerConfigure
  | { type: 'enable' }
  | { type: 'disable' }
  | { type: 'shutdown' }

export type FromOutputWorker = {
  type: 'stats'
  packetsPerSec: number
  lastError: string | null
  protocolName: string
}
