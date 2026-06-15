import type { OutputProtocolConfig } from './OutputProtocol'

/** Messages between the engine host main thread and the output worker. */

export interface OutputWorkerData {
  sab: SharedArrayBuffer
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
