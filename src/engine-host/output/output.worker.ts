import { parentPort, workerData } from 'node:worker_threads'
import type { OutputProtocolKind } from '@shared/output/config'
import { createOutputProtocol } from './createOutputProtocol'
import type { OutputProtocol } from './OutputProtocol'
import type { FromOutputWorker, OutputWorkerData, ToOutputWorker } from './workerMessages'

/**
 * Output sender thread. Runs its own tick, independent of the evaluator —
 * a slow evaluation frame never delays a DMX packet.
 */

if (parentPort === null) throw new Error('output.worker must run as a worker_thread')
const port = parentPort

const { sab, control } = workerData as OutputWorkerData
const view = new Uint8Array(sab)
const seq = new Int32Array(control)

let protocol: OutputProtocol = createOutputProtocol({ protocol: 'sacn', startUniverse: 1 })
let protocolKind: OutputProtocolKind = 'sacn'
let pixelCount = 170
let enabled = false
let sending = false
let packetCount = 0
let lastError: string | null = null
let protocolName = 'sACN'

// Private copy of the most recent torn-free frame. We always send from here so
// a frame the evaluator was mid-writing is never transmitted.
let frame = new Uint8Array(pixelCount * 3)

/**
 * Seqlock read: copy the shared pixel buffer into `frame` only if the evaluator
 * was not writing during the copy. Returns false (keep the previous frame) on
 * contention — sACN/Art-Net resends make a one-tick repeat harmless.
 */
function readStableFrame(byteCount: number): void {
  if (frame.length !== byteCount) frame = new Uint8Array(byteCount)
  const before = Atomics.load(seq, 0)
  if ((before & 1) !== 0) return // writer mid-write
  frame.set(view.subarray(0, byteCount))
  const after = Atomics.load(seq, 0)
  if (after !== before) return // torn during copy — keep the last good frame
}

let tickTimer: NodeJS.Timeout = setInterval(tick, 1000 / 44)

const statsTimer = setInterval(() => {
  const msg: FromOutputWorker = { type: 'stats', packetsPerSec: packetCount, lastError, protocolName }
  port.postMessage(msg)
  packetCount = 0
}, 1000)

port.on('message', (msg: ToOutputWorker) => {
  switch (msg.type) {
    case 'configure':
      if (msg.protocol !== protocolKind) {
        protocol.close()
        protocol = createOutputProtocol(msg)
        protocolKind = msg.protocol
        protocolName = protocol.name
      }
      pixelCount = msg.pixelCount
      protocol.configure(msg)
      clearInterval(tickTimer)
      tickTimer = setInterval(tick, 1000 / msg.targetFps)
      break
    case 'enable':
      enabled = true
      break
    case 'disable':
      enabled = false
      break
    case 'shutdown':
      clearInterval(tickTimer)
      clearInterval(statsTimer)
      protocol.close()
      process.exit(0)
  }
})

function tick(): void {
  if (!enabled || sending) return
  sending = true
  readStableFrame(pixelCount * 3)
  const stream = frame.subarray(0, pixelCount * 3)
  protocol
    .send(stream)
    .then((packets) => {
      packetCount += packets
      lastError = null
    })
    .catch((err: unknown) => {
      lastError = err instanceof Error ? err.message : String(err)
    })
    .finally(() => {
      sending = false
    })
}
