import { CHANNELS_PER_PIXEL } from '../messages'

/** FSEQ v2 fixed header size (bytes). */
export const FSEQ_HEADER_BYTES = 32

/** FSEQ step time is a single byte (milliseconds per frame). */
export const FSEQ_MIN_STEP_MS = 1
export const FSEQ_MAX_STEP_MS = 255

const FSEQ_PRODUCER = 'PixelForge Editor'

export interface FseqEncodeInput {
  /** Dense RGB frames, `frameCount × pixelCount × 3` bytes (0–255). */
  frames: Uint8Array
  frameCount: number
  pixelCount: number
  fps: number
}

export interface FseqEncodeResult {
  data: Uint8Array
  channelCount: number
  frameCount: number
  stepTimeMs: number
  error: string | null
}

export interface FseqExportValidation {
  ok: boolean
  errors: string[]
  warnings: string[]
}

/** Map bake FPS to FSEQ step time (ms). Returns null when outside 1–255 ms. */
export function stepTimeFromFps(fps: number): number | null {
  if (!Number.isFinite(fps) || fps <= 0) return null
  const stepMs = Math.round(1000 / fps)
  if (stepMs < FSEQ_MIN_STEP_MS || stepMs > FSEQ_MAX_STEP_MS) return null
  return stepMs
}

/** Effective playback FPS implied by an integer step time. */
export function fpsFromStepTime(stepTimeMs: number): number {
  return 1000 / stepTimeMs
}

export function estimateFseqBytes(pixelCount: number, frameCount: number, includeProducerHeader = true): number {
  const channelCount = pixelCount * CHANNELS_PER_PIXEL
  const producerBytes = includeProducerHeader ? sequenceProducerHeader().length : 0
  return FSEQ_HEADER_BYTES + producerBytes + frameCount * channelCount
}

function sequenceProducerHeader(producer = FSEQ_PRODUCER): Uint8Array {
  const text = `${producer}\0`
  const length = 4 + text.length
  const buf = new Uint8Array(length)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  view.setUint16(0, length, true)
  buf[2] = 's'.charCodeAt(0)
  buf[3] = 'p'.charCodeAt(0)
  for (let i = 0; i < text.length; i++) {
    buf[4 + i] = text.charCodeAt(i)
  }
  return buf
}

export function validateFseqExport(
  pixelCount: number,
  frameCount: number,
  fps: number,
  fseqByteLength: number
): FseqExportValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (pixelCount <= 0) errors.push('Patch has no pixels.')
  if (frameCount <= 0) errors.push('Animation has no frames.')
  if (fps <= 0) errors.push('Frame rate must be greater than zero.')

  const stepTimeMs = stepTimeFromFps(fps)
  if (stepTimeMs === null) {
    errors.push(
      `FPS ${fps} yields a step time outside ${FSEQ_MIN_STEP_MS}–${FSEQ_MAX_STEP_MS} ms (FSEQ limit). Try 4–1000 fps.`
    )
  } else if (Math.abs(fpsFromStepTime(stepTimeMs) - fps) > 0.5) {
    warnings.push(
      `FSEQ step time is ${stepTimeMs} ms (~${fpsFromStepTime(stepTimeMs).toFixed(1)} fps), not exactly ${fps} fps.`
    )
  }

  if (fseqByteLength <= FSEQ_HEADER_BYTES) errors.push('Encoded sequence file is empty.')

  const channelCount = pixelCount * CHANNELS_PER_PIXEL
  if (channelCount > 0 && frameCount > 0) {
    const mb = fseqByteLength / 1024 / 1024
    if (mb > 512) {
      warnings.push(`Sequence file is ${mb.toFixed(0)} MB — upload may be slow on FPP.`)
    } else if (mb > 100) {
      warnings.push(`Sequence file is ${mb.toFixed(1)} MB.`)
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

/**
 * Encode dense baked RGB frames into Falcon Player / xLights FSEQ v2 (uncompressed).
 * Channel order is RGB interleaved in patch wiring order (pixel 0 → channels 0–2).
 */
export function encodeFseq(input: FseqEncodeInput): FseqEncodeResult {
  const { frames, frameCount, pixelCount, fps } = input
  const fail = (error: string): FseqEncodeResult => ({
    data: new Uint8Array(0),
    channelCount: pixelCount * CHANNELS_PER_PIXEL,
    frameCount,
    stepTimeMs: 0,
    error
  })

  const stepTimeMs = stepTimeFromFps(fps)
  if (stepTimeMs === null) {
    return fail(
      `FPS ${fps} is not compatible with FSEQ (step time must be ${FSEQ_MIN_STEP_MS}–${FSEQ_MAX_STEP_MS} ms).`
    )
  }

  if (pixelCount <= 0 || frameCount <= 0) {
    return fail('Invalid bake: pixel count and frame count must be positive.')
  }

  const channelCount = pixelCount * CHANNELS_PER_PIXEL
  const frameBytes = frameCount * channelCount
  if (frames.length < frameBytes) {
    return fail(`Bake buffer too short: expected ${frameBytes} bytes, got ${frames.length}.`)
  }

  const producerHeader = sequenceProducerHeader()
  const dataOffset = FSEQ_HEADER_BYTES + producerHeader.length
  const totalBytes = dataOffset + frameBytes
  const data = new Uint8Array(totalBytes)
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)

  data[0] = 0x50
  data[1] = 0x53
  data[2] = 0x45
  data[3] = 0x51
  view.setUint16(4, dataOffset, true)
  data[6] = 0
  data[7] = 2
  view.setUint16(8, FSEQ_HEADER_BYTES, true)
  view.setUint32(10, channelCount, true)
  view.setUint32(14, frameCount, true)
  data[18] = stepTimeMs
  data[19] = 0
  data[20] = 0
  data[21] = 0
  data[22] = 0
  data[23] = 0
  view.setBigUint64(24, BigInt(Date.now()), true)

  data.set(producerHeader, FSEQ_HEADER_BYTES)
  data.set(frames.subarray(0, frameBytes), dataOffset)

  return { data, channelCount, frameCount, stepTimeMs, error: null }
}
