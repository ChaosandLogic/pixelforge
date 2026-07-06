import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  encodeFseq,
  estimateFseqBytes,
  FSEQ_HEADER_BYTES,
  fpsFromStepTime,
  stepTimeFromFps,
  validateFseqExport
} from '../shared/export/fseq'

describe('stepTimeFromFps', () => {
  it('maps common frame rates to integer milliseconds', () => {
    assert.equal(stepTimeFromFps(44), 23)
    assert.equal(stepTimeFromFps(40), 25)
    assert.equal(stepTimeFromFps(20), 50)
  })

  it('rejects fps outside FSEQ step range', () => {
    assert.equal(stepTimeFromFps(0), null)
    assert.equal(stepTimeFromFps(3), null)
  })
})

describe('encodeFseq', () => {
  it('writes PSEQ v2 header and RGB channel data', () => {
    const pixelCount = 2
    const frameCount = 2
    const frames = new Uint8Array([
      255, 0, 0, 0, 255, 0,
      10, 20, 30, 40, 50, 60
    ])
    const result = encodeFseq({ frames, frameCount, pixelCount, fps: 40 })
    assert.equal(result.error, null)
    assert.equal(result.stepTimeMs, 25)
    assert.equal(result.channelCount, 6)

    const producerLen = result.data.length - FSEQ_HEADER_BYTES - frameCount * 6
    assert.equal(producerLen, 22)

    assert.equal(result.data[0], 0x50)
    assert.equal(result.data[1], 0x53)
    assert.equal(result.data[2], 0x45)
    assert.equal(result.data[3], 0x51)
    assert.equal(result.data[7], 2)

    const view = new DataView(result.data.buffer, result.data.byteOffset, result.data.byteLength)
    assert.equal(view.getUint16(4, true), FSEQ_HEADER_BYTES + producerLen)
    assert.equal(view.getUint32(10, true), 6)
    assert.equal(view.getUint32(14, true), 2)
    assert.equal(result.data[18], 25)
    assert.equal(result.data[32], 22)
    assert.equal(result.data[34], 's'.charCodeAt(0))
    assert.equal(result.data[35], 'p'.charCodeAt(0))

    const dataOff = FSEQ_HEADER_BYTES + producerLen
    assert.equal(result.data[dataOff], 255)
    assert.equal(result.data[dataOff + 6], 10)
  })

  it('rejects incompatible fps', () => {
    const frames = new Uint8Array(3)
    const result = encodeFseq({ frames, frameCount: 1, pixelCount: 1, fps: 3 })
    assert.notEqual(result.error, null)
  })
})

describe('validateFseqExport', () => {
  it('warns when rounded step time differs from requested fps', () => {
    const validation = validateFseqExport(10, 100, 44, estimateFseqBytes(10, 100))
    assert.equal(validation.ok, true)
    assert.ok(validation.warnings.some((w) => w.includes('step time')))
    assert.equal(fpsFromStepTime(23), 1000 / 23)
  })
})

describe('estimateFseqBytes', () => {
  it('includes header, producer block, and frame data', () => {
    assert.equal(estimateFseqBytes(100, 50), 32 + 22 + 100 * 3 * 50)
  })
})
