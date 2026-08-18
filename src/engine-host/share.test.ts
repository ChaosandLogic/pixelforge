import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { samplePackedToRgb, streamToBgra } from '../shared/share/frame'
import { mergeShareSenders, parseShareSender, shareInputsFromGraph, shareSenderLabel } from '../shared/share/senders'

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

describe('shareSenderLabel', () => {
  it('uses name when app is missing', () => {
    assert.equal(shareSenderLabel({ name: 'Composition' }), 'Composition')
  })

  it('combines app and server name', () => {
    assert.equal(shareSenderLabel({ name: 'Composition', appName: 'Resolume Arena' }), 'Resolume Arena — Composition')
  })

  it('parses a composite label back into name and app', () => {
    assert.deepEqual(parseShareSender('Resolume Arena — Composition'), {
      name: 'Composition',
      appName: 'Resolume Arena'
    })
  })

  it('merges sender lists without duplicates', () => {
    assert.deepEqual(mergeShareSenders(['A', ''], ['A', 'B']), ['A', 'B'])
  })

  it('collects syphon-in subscriptions from a graph', () => {
    assert.deepEqual(
      shareInputsFromGraph({
        nodes: [
          { id: 'a', type: 'generator/syphon-in', position: { x: 0, y: 0 }, params: { sender: 'App — Comp' } },
          { id: 'b', type: 'generator/wave', position: { x: 0, y: 0 }, params: {} }
        ],
        edges: []
      }),
      [{ nodeId: 'a', sender: 'App — Comp' }]
    )
  })
})
