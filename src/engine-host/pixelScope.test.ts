import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  copyScopedPixels,
  mapScopedPixels,
  pixelScopeFromSrc,
  pixelsForBlend
} from '../shared/graph/pixelScope'
import type { EvalContext } from '../shared/graph/types'
import type { FixtureRange } from '../shared/patch/layout'

function stubCtx(
  pixelCount: number,
  fixtureRanges: FixtureRange[] = []
): EvalContext {
  return {
    timeMs: 0,
    deltaMs: 16,
    pixelCount,
    resolution: { width: pixelCount, height: 1 },
    positions: new Float32Array(pixelCount * 3),
    fixtureRanges,
    nodeId: 'n',
    acquire: () => new Float32Array(pixelCount * 3),
    getMediaFrame: () => null,
    getAudioLevels: () => null,
    getMidiState: () => null,
    getKeyboardState: () => null,
    getOscState: () => null,
    smoothFloat: (v) => v,
    randomFloat: () => 0,
    getSequenceBeatOffset: () => 0,
    setSequenceBeatOffset: () => {},
    consumeTrigger: () => false,
    evalInput: () => null,
    delayFloat: (v) => v,
    holdFloat: (v) => v,
    rampFloat: () => 0,
    risingEdge: () => {},
    emitTrigger: () => {},
    pulseTrigger: () => {},
    componentInputs: null,
    evalSubgraph: () => null,
    markScheduleFired: () => false,
    advanceTimelineLoop: () => {},
    feedbackPixels: () => new Float32Array(pixelCount * 3)
  }
}

const fixtureRange: FixtureRange = {
  id: 'f1',
  name: 'Strip',
  start: 2,
  count: 3,
  width: 3,
  height: 1
}

describe('pixelScopeFromSrc', () => {
  it('treats full-length buffers as full patch', () => {
    const ctx = stubCtx(10)
    const src = new Float32Array(30)
    const scope = pixelScopeFromSrc(src, ctx)
    assert.equal(scope.fullPatch, true)
    assert.equal(scope.count, 10)
  })

  it('matches compact buffers to fixture ranges', () => {
    const ctx = stubCtx(10, [fixtureRange])
    const src = new Float32Array(9)
    const scope = pixelScopeFromSrc(src, ctx)
    assert.equal(scope.fullPatch, false)
    assert.equal(scope.count, 3)
    assert.deepEqual(scope.indices, [2, 3, 4])
    assert.deepEqual(scope.resolution, { width: 3, height: 1 })
  })
})

describe('pixelsForBlend', () => {
  it('scatters compact fixture pixels into a full-patch buffer', () => {
    const ctx = stubCtx(10, [fixtureRange])
    const compact = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
    const full = pixelsForBlend(compact, ctx)!
    assert.equal(full.length, 30)
    assert.deepEqual(
      Array.from(full.slice(6, 15)),
      [1, 0, 0, 0, 1, 0, 0, 0, 1]
    )
    assert.equal(full[0], 0)
    assert.equal(full[15], 0)
  })

  it('returns full buffers unchanged', () => {
    const ctx = stubCtx(4)
    const full = new Float32Array(12)
    full.fill(0.5)
    assert.equal(pixelsForBlend(full, ctx), full)
  })
})

describe('copyScopedPixels', () => {
  it('expands compact input like pixelsForBlend', () => {
    const ctx = stubCtx(10, [fixtureRange])
    const compact = new Float32Array([0.25, 0.5, 0.75, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6])
    const out = copyScopedPixels(compact, ctx)
    assert.deepEqual(Array.from(out.slice(6, 15)), Array.from(compact))
    assert.equal(out[0], 0)
    assert.equal(out[27], 0)
  })
})

describe('mapScopedPixels', () => {
  it('maps only scoped pixels into full-patch output', () => {
    const ctx = stubCtx(10, [fixtureRange])
    const compact = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
    const out = mapScopedPixels(compact, ctx, (r, g, b) => [r * 2, g * 2, b * 2])
    assert.deepEqual(
      Array.from(out.slice(6, 15)),
      Array.from(compact, (v) => v * 2)
    )
    assert.equal(out[0], 0)
    assert.equal(out[15], 0)
  })
})
