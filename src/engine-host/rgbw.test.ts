import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { encodeFseq } from '../shared/export/fseq'
import {
  channelsPerPixel,
  dmxChannelsPerUniverse,
  expandRgbToRgbw,
  packOutputStream,
  pixelsPerUniverse,
  rgbToRgbw
} from '../shared/output/rgbw'
import { deriveAddress, universeCountFor } from '../shared/patch/types'

describe('rgbToRgbw', () => {
  it('extracts shared white subtractively', () => {
    assert.deepEqual(rgbToRgbw(200, 150, 100, 'subtractive'), [100, 50, 0, 100])
    assert.deepEqual(rgbToRgbw(40, 40, 40, 'subtractive'), [0, 0, 0, 40])
    assert.deepEqual(rgbToRgbw(255, 0, 0, 'subtractive'), [255, 0, 0, 0])
  })

  it('adds luminance white without changing RGB', () => {
    const [r, g, b, w] = rgbToRgbw(255, 255, 255, 'luminance')
    assert.deepEqual([r, g, b], [255, 255, 255])
    assert.equal(w, 255)

    const dim = rgbToRgbw(0, 0, 255, 'luminance')
    assert.deepEqual(dim.slice(0, 3), [0, 0, 255])
    assert.equal(dim[3], Math.round(0.0722 * 255))
  })
})

describe('expandRgbToRgbw', () => {
  it('expands a packed RGB frame and reuses the output buffer', () => {
    const rgb = new Uint8Array([255, 128, 64, 10, 20, 30])
    const out = new Uint8Array(16)
    const first = expandRgbToRgbw(rgb, 2, 'subtractive', out)
    assert.equal(first.buffer, out.buffer)
    assert.deepEqual([...first.subarray(0, 4)], [191, 64, 0, 64])
    assert.deepEqual([...first.subarray(4, 8)], [0, 10, 20, 10])
  })
})

describe('packOutputStream', () => {
  it('passes RGB through and expands RGBW', () => {
    const rgb = new Uint8Array([8, 8, 8])
    const rgbStream = packOutputStream(rgb, 1, 'rgb', 'subtractive')
    assert.equal(rgbStream.length, 3)
    const rgbw = packOutputStream(rgb, 1, 'rgbw', 'subtractive')
    assert.deepEqual([...rgbw], [0, 0, 0, 8])
  })
})

describe('universe addressing', () => {
  it('uses 170 RGB / 128 RGBW pixels per universe', () => {
    assert.equal(pixelsPerUniverse('rgb'), 170)
    assert.equal(pixelsPerUniverse('rgbw'), 128)
    assert.equal(dmxChannelsPerUniverse('rgb'), 510)
    assert.equal(dmxChannelsPerUniverse('rgbw'), 512)
    assert.equal(channelsPerPixel('rgbw'), 4)

    assert.equal(universeCountFor(170, 'rgb'), 1)
    assert.equal(universeCountFor(171, 'rgb'), 2)
    assert.equal(universeCountFor(128, 'rgbw'), 1)
    assert.equal(universeCountFor(129, 'rgbw'), 2)

    assert.deepEqual(deriveAddress(0, 1, 'rgbw'), { universe: 1, channel: 1 })
    assert.deepEqual(deriveAddress(128, 1, 'rgbw'), { universe: 2, channel: 1 })
    assert.deepEqual(deriveAddress(170, 1, 'rgb'), { universe: 2, channel: 1 })
  })
})

describe('encodeFseq RGBW', () => {
  it('expands baked RGB frames to RGBW channels', () => {
    const frames = new Uint8Array([200, 150, 100])
    const result = encodeFseq({
      frames,
      frameCount: 1,
      pixelCount: 1,
      fps: 40,
      colorMode: 'rgbw',
      whiteMode: 'subtractive'
    })
    assert.equal(result.error, null)
    assert.equal(result.channelCount, 4)
    const dataOff = result.data.length - 4
    assert.deepEqual([...result.data.subarray(dataOff)], [100, 50, 0, 100])
  })
})
