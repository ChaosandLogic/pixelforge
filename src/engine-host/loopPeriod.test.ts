import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  bakeExportWarnings,
  detectLoopPeriod,
  formatLoopPeriodSec,
  nonLoopableSources,
  resolveLoopBakeDuration,
  snapDurationToLoop
} from '../shared/export/loopPeriod'
import { formatLoopSeam, measureLoopSeam } from '../shared/export/loopSeam'
import type { GraphData } from '../shared/graph/types'

function graph(nodes: GraphData['nodes']): GraphData {
  return { nodes, edges: [] }
}

describe('detectLoopPeriod', () => {
  it('returns LCM of gradient and LFO periods', () => {
    const result = detectLoopPeriod(
      graph([
        {
          id: 'g1',
          type: 'generator/gradient',
          position: { x: 0, y: 0 },
          params: { speed: 0.5 }
        },
        {
          id: 'l1',
          type: 'time/lfo',
          position: { x: 0, y: 0 },
          params: { frequency: 0.25 }
        }
      ])
    )
    assert.equal(result.periodSec, 4)
    assert.equal(result.sources.length, 2)
  })

  it('ignores static graphs', () => {
    const result = detectLoopPeriod(
      graph([
        {
          id: 's1',
          type: 'generator/solid-colour',
          position: { x: 0, y: 0 },
          params: {}
        }
      ])
    )
    assert.equal(result.periodSec, null)
  })

  it('recovers a clean common multiple for fractional rates', () => {
    // speed 3 Hz → 1/3 s, LFO 2 Hz → 1/2 s. True combined loop is 1 s; the old
    // millisecond-grid LCM produced 166.5 s from gcd(333, 500) = 1.
    const result = detectLoopPeriod(
      graph([
        { id: 'g1', type: 'generator/gradient', position: { x: 0, y: 0 }, params: { speed: 3 } },
        { id: 'l1', type: 'time/lfo', position: { x: 0, y: 0 }, params: { frequency: 2 } }
      ])
    )
    assert.ok(result.periodSec !== null)
    assert.ok(Math.abs(result.periodSec! - 1) < 1e-6, `expected ~1s, got ${result.periodSec}`)
  })

  it('returns null when no practical clean loop exists', () => {
    // Periods of 61 s and 67 s (coprime) have an LCM of 4087 s, past the 3600 s
    // cap, so there is no sensible seamless loop — must report null, not snap to
    // a multi-hour bake.
    const result = detectLoopPeriod(
      graph([
        { id: 'g1', type: 'generator/gradient', position: { x: 0, y: 0 }, params: { speed: 1 / 61 } },
        { id: 'l1', type: 'time/lfo', position: { x: 0, y: 0 }, params: { frequency: 1 / 67 } }
      ])
    )
    assert.equal(result.periodSec, null)
  })

  it('uses sequence loop length in seconds', () => {
    const result = detectLoopPeriod(
      graph([
        {
          id: 'seq',
          type: 'sequence/sequence',
          position: { x: 0, y: 0 },
          params: {
            bpm: 120,
            loop: true,
            segments: [
              { id: 'a', duration: 4, transition: { type: 'cut', duration: 0, curve: 'linear' } },
              { id: 'b', duration: 4, transition: { type: 'cut', duration: 0, curve: 'linear' } }
            ]
          }
        }
      ])
    )
    assert.equal(result.periodSec, 4)
  })
})

describe('nonLoopableSources', () => {
  it('flags animating stochastic and stateful nodes', () => {
    const g = graph([
      { id: 'tw', type: 'generator/twinkle', position: { x: 0, y: 0 }, params: { speed: 2 } },
      { id: 'fb', type: 'composite/feedback', position: { x: 0, y: 0 }, params: {} },
      { id: 'out', type: 'output/pixel', position: { x: 0, y: 0 }, params: {} }
    ])
    g.edges = [
      { id: 'e1', fromNode: 'tw', fromPort: 'pixels', toNode: 'fb', toPort: 'pixels' },
      { id: 'e2', fromNode: 'fb', fromPort: 'pixels', toNode: 'out', toPort: 'pixels' }
    ]
    const sources = nonLoopableSources(g)
    assert.equal(sources.length, 2)
  })

  it('ignores static (speed 0) stochastic nodes', () => {
    const sources = nonLoopableSources(
      graph([
        { id: 'tw', type: 'generator/twinkle', position: { x: 0, y: 0 }, params: { speed: 0 } }
      ])
    )
    assert.equal(sources.length, 0)
  })

  it('surfaces a bake warning for non-repeating content', () => {
    const warnings = bakeExportWarnings(
      graph([
        { id: 'fire', type: 'generator/fire', position: { x: 0, y: 0 }, params: { speed: 1.2 } }
      ])
    )
    assert.ok(warnings.some((w) => /non-repeating content/.test(w)))
  })
})

describe('snapDurationToLoop', () => {
  it('snaps to the nearest whole number of periods', () => {
    assert.equal(snapDurationToLoop(30, 2), 30)
    assert.equal(snapDurationToLoop(31, 2), 32)
    assert.equal(snapDurationToLoop(29, 2), 30)
  })
})

describe('resolveLoopBakeDuration', () => {
  it('keeps duration when seamless loop is off', () => {
    const result = resolveLoopBakeDuration(30, false, 'auto', 0, graph([]))
    assert.deepEqual(result, { bakeDurationSec: 30, periodSec: null, snapped: false })
  })

  it('snaps when seamless loop is on with manual period', () => {
    const result = resolveLoopBakeDuration(30, true, 'manual', 2.5, graph([]))
    assert.equal(result.bakeDurationSec, 30)
    assert.equal(result.periodSec, 2.5)
    assert.equal(result.snapped, false)
  })
})

describe('measureLoopSeam', () => {
  it('reports perfect match for identical frames', () => {
    const frames = new Uint8Array([255, 0, 0, 0, 255, 0, 255, 0, 0, 0, 255, 0])
    const result = measureLoopSeam(frames, 2, 2)
    assert.equal(result.matchPercent, 100)
    assert.equal(result.meanDelta, 0)
  })

  it('reports partial match when last frame differs', () => {
    const frames = new Uint8Array([255, 0, 0, 0, 255, 0, 10, 0, 0, 0, 255, 0])
    const result = measureLoopSeam(frames, 2, 2)
    assert.equal(result.matchPercent, 83.33333333333334)
    assert.ok(result.meanDelta > 0)
    assert.ok(result.maxDelta >= result.meanDelta)
    assert.match(formatLoopSeam(result), /Loop match:/)
  })

  it('tolerates single-code (±1) quantisation noise', () => {
    // frame0 vs last differs by 1 on every channel — visually identical.
    const frames = new Uint8Array([100, 100, 100, 101, 101, 101])
    const result = measureLoopSeam(frames, 2, 1)
    assert.equal(result.matchPercent, 100)
    assert.equal(result.maxDelta, 1)
  })

  it('measures against the guard frame when provided', () => {
    // Last baked frame differs from frame 0 (mid-motion), but the loop-boundary
    // guard frame matches frame 0 exactly → a clean loop.
    const frames = new Uint8Array([255, 0, 0, 128, 0, 0])
    const seamFrame = new Uint8Array([255, 0, 0])
    const withGuard = measureLoopSeam(frames, 2, 1, seamFrame)
    assert.equal(withGuard.matchPercent, 100)
    const withoutGuard = measureLoopSeam(frames, 2, 1)
    assert.ok(withoutGuard.matchPercent < 100)
  })
})

describe('formatLoopPeriodSec', () => {
  it('formats short and long periods', () => {
    assert.equal(formatLoopPeriodSec(0.5), '0.500 s')
    assert.equal(formatLoopPeriodSec(12.34), '12.3 s')
  })
})
