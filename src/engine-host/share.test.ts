import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { samplePackedToRgb, streamToBgra } from '../shared/share/frame'

describe('samplePackedToRgb', () => {
  it('converts RGBA to RGB at 1:1', () => {
    const src = Uint8Array.of(10, 20, 30, 255, 40, 50, 60, 255)
    const out = samplePackedToRgb(src, 2, 1, 2, 1, false)
    assert.deepEqual([...out], [10, 20, 30, 40, 50, 60])
  })

  it('swaps BGRA channels', () => {
    const src = Uint8Array.of(30, 20, 10, 255)
    const out = samplePackedToRgb(src, 1, 1, 1, 1, true)
    assert.deepEqual([...out], [10, 20, 30])
  })
})

describe('streamToBgra', () => {
  it('writes BGRA with full alpha', () => {
    const pixels = Float32Array.of(1, 0, 0)
    const buf = streamToBgra(pixels, 1, 1, 1, 1)
    assert.equal(buf[0], 0)
    assert.equal(buf[1], 0)
    assert.equal(buf[2], 255)
    assert.equal(buf[3], 255)
  })
})
