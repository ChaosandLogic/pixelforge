import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ALED_MAGIC,
  encodeAled,
  ESP_TYPICAL_SPIFFS_BYTES,
  estimateAledMaxBytes,
  validateEspExport
} from '../shared/export/aled'

describe('encodeAled', () => {
  it('writes ALED header and full first frame', () => {
    const pixelCount = 2
    const frameCount = 1
    const frames = new Uint8Array([255, 0, 0, 0, 255, 0])
    const result = encodeAled({ frames, frameCount, pixelCount, fps: 30 })
    assert.equal(result.error, null)
    assert.equal(result.data.length, 16 + 2 + 2 * 5)

    const view = new DataView(result.data.buffer, result.data.byteOffset, result.data.byteLength)
    assert.equal(view.getUint32(0, true), ALED_MAGIC)
    assert.equal(view.getUint32(4, true), 2)
    assert.equal(view.getUint32(8, true), 1)
    assert.equal(view.getFloat32(12, true), 30)
    assert.equal(view.getUint16(16, true), 2)
    assert.equal(view.getUint16(18, true), 0)
    assert.equal(view.getUint8(20), 255)
    assert.equal(view.getUint8(21), 0)
    assert.equal(view.getUint8(22), 0)
    assert.equal(view.getUint16(23, true), 1)
    assert.equal(view.getUint8(25), 0)
    assert.equal(view.getUint8(26), 255)
    assert.equal(view.getUint8(27), 0)
  })

  it('delta-compresses unchanged LEDs on later frames', () => {
    const pixelCount = 3
    const frames = new Uint8Array([
      10, 20, 30, 40, 50, 60, 70, 80, 90,
      10, 20, 30, 99, 50, 60, 70, 80, 90
    ])
    const result = encodeAled({ frames, frameCount: 2, pixelCount, fps: 24 })
    assert.equal(result.error, null)

    const view = new DataView(result.data.buffer, result.data.byteOffset, result.data.byteLength)
    assert.equal(view.getUint16(16, true), 3)
    const frame2Updates = view.getUint16(16 + 2 + 3 * 5, true)
    assert.equal(frame2Updates, 1)
    const ledIdx = view.getUint16(16 + 2 + 3 * 5 + 2, true)
    assert.equal(ledIdx, 1)
    assert.equal(view.getUint8(16 + 2 + 3 * 5 + 4), 99)
  })

  it('rejects patches over ESPixel LED limit', () => {
    const result = encodeAled({
      frames: new Uint8Array(301 * 3),
      frameCount: 1,
      pixelCount: 301,
      fps: 30
    })
    assert.notEqual(result.error, null)
  })
})

describe('validateEspExport', () => {
  it('flags SPIFFS size warnings', () => {
    const big = ESP_TYPICAL_SPIFFS_BYTES + 1
    const v = validateEspExport(100, 1000, 30, big)
    assert.equal(v.ok, true)
    assert.ok(v.warnings.some((w) => w.includes('SPIFFS')))
  })
})

describe('estimateAledMaxBytes', () => {
  it('scales with pixels and frames', () => {
    assert.ok(estimateAledMaxBytes(10, 100) > estimateAledMaxBytes(10, 50))
  })
})
