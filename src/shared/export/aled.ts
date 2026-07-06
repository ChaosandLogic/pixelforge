/** ESPixel animation file magic ("ALED"). */
export const ALED_MAGIC = 0x414c4544

/** Maximum LEDs supported by ESPixel firmware. */
export const ESP_MAX_LEDS = 300

/** Typical SPIFFS budget on a 4 MB ESP32 (bytes). */
export const ESP_TYPICAL_SPIFFS_BYTES = Math.floor(1.5 * 1024 * 1024)

const ALED_HEADER_BYTES = 16

export interface AledEncodeInput {
  /** Dense RGB frames, `frameCount × pixelCount × 3` bytes (0–255). */
  frames: Uint8Array
  frameCount: number
  pixelCount: number
  fps: number
}

export interface AledEncodeResult {
  data: Uint8Array
  ledCount: number
  frameCount: number
  fps: number
  error: string | null
}

export interface EspExportValidation {
  ok: boolean
  errors: string[]
  warnings: string[]
}

function rgbKey(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b
}

/** Rough upper-bound size before baking (worst-case full delta per frame). */
export function estimateAledMaxBytes(pixelCount: number, frameCount: number): number {
  const perFrame = 2 + pixelCount * 5
  return ALED_HEADER_BYTES + frameCount * perFrame
}

export function validateEspExport(
  pixelCount: number,
  frameCount: number,
  fps: number,
  aledByteLength: number
): EspExportValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (pixelCount <= 0) errors.push('Patch has no pixels.')
  if (pixelCount > ESP_MAX_LEDS) {
    errors.push(`Patch has ${pixelCount} pixels; ESPixel supports at most ${ESP_MAX_LEDS}.`)
  }
  if (frameCount <= 0) errors.push('Animation has no frames.')
  if (fps <= 0) errors.push('Frame rate must be greater than zero.')
  if (aledByteLength <= ALED_HEADER_BYTES) errors.push('Encoded show file is empty.')

  if (aledByteLength > ESP_TYPICAL_SPIFFS_BYTES) {
    warnings.push(
      `Show file is ${(aledByteLength / 1024 / 1024).toFixed(2)} MB — may not fit in ESPixel SPIFFS (~1.5 MB typical).`
    )
  }

  return { ok: errors.length === 0, errors, warnings }
}

/**
 * Encode dense baked RGB frames into ESPixel ALED `.bin` format (delta-compressed).
 * LED index `i` maps to patch pixel `i` in wiring order.
 */
export function encodeAled(input: AledEncodeInput): AledEncodeResult {
  const { frames, frameCount, pixelCount, fps } = input
  const fail = (error: string): AledEncodeResult => ({
    data: new Uint8Array(0),
    ledCount: pixelCount,
    frameCount,
    fps,
    error
  })

  if (pixelCount <= 0 || frameCount <= 0 || fps <= 0) {
    return fail('Invalid bake: pixel count, frame count, and fps must be positive.')
  }
  if (pixelCount > ESP_MAX_LEDS) {
    return fail(`LED count ${pixelCount} exceeds ESPixel maximum (${ESP_MAX_LEDS}).`)
  }

  const expectedBytes = frameCount * pixelCount * 3
  if (frames.length < expectedBytes) {
    return fail(`Bake buffer too short: expected ${expectedBytes} bytes, got ${frames.length}.`)
  }

  const chunks: Uint8Array[] = []
  const header = new ArrayBuffer(ALED_HEADER_BYTES)
  const hv = new DataView(header)
  hv.setUint32(0, ALED_MAGIC, true)
  hv.setUint32(4, pixelCount, true)
  hv.setUint32(8, frameCount, true)
  hv.setFloat32(12, fps, true)
  chunks.push(new Uint8Array(header))

  const prevRgb = new Int32Array(pixelCount)
  prevRgb.fill(-1)

  for (let f = 0; f < frameCount; f++) {
    const frameOff = f * pixelCount * 3
    const updates: number[] = []

    for (let i = 0; i < pixelCount; i++) {
      const off = frameOff + i * 3
      const r = frames[off] ?? 0
      const g = frames[off + 1] ?? 0
      const b = frames[off + 2] ?? 0
      const key = rgbKey(r, g, b)
      if (prevRgb[i] !== key) {
        prevRgb[i] = key
        updates.push(i, r, g, b)
      }
    }

    const updateCount = updates.length / 4
    const frameBuf = new ArrayBuffer(2 + updateCount * 5)
    const fv = new DataView(frameBuf)
    fv.setUint16(0, updateCount, true)
    let o = 2
    for (let u = 0; u < updateCount; u++) {
      const base = u * 4
      fv.setUint16(o, updates[base] as number, true)
      o += 2
      fv.setUint8(o, updates[base + 1] as number)
      fv.setUint8(o + 1, updates[base + 2] as number)
      fv.setUint8(o + 2, updates[base + 3] as number)
      o += 3
    }
    chunks.push(new Uint8Array(frameBuf))
  }

  const total = chunks.reduce((n, c) => n + c.length, 0)
  const data = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.length
  }

  return { data, ledCount: pixelCount, frameCount, fps, error: null }
}
