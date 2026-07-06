import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  timelineLoop,
  timelineLoopPeriodSec,
  timelinePhase,
  TIMELINE_NODE_TYPE
} from '../shared/graph/nodes/time/Timeline'
import { detectLoopPeriod, timelineExportWarnings, upstreamNodeIds, bakeExportWarnings } from '../shared/export/loopPeriod'
import type { GraphData } from '../shared/graph/types'

function graph(nodes: GraphData['nodes']): GraphData {
  return { nodes, edges: [] }
}

describe('timelineLoop', () => {
  it('converts seconds mode at BPM', () => {
    const result = timelineLoop({ durationMode: 'seconds', durationSec: 8, bpm: 120 })
    assert.equal(result.loopSec, 8)
    assert.equal(result.loopBeats, 16)
  })

  it('converts beats mode at BPM', () => {
    const result = timelineLoop({ durationMode: 'beats', durationBeats: 8, bpm: 120 })
    assert.equal(result.loopBeats, 8)
    assert.equal(result.loopSec, 4)
  })
})

describe('timelineLoopPeriodSec', () => {
  it('returns null when loop is disabled', () => {
    assert.equal(timelineLoopPeriodSec({ loop: false, durationSec: 8 }), null)
  })

  it('returns seconds for looping timeline', () => {
    assert.equal(timelineLoopPeriodSec({ durationSec: 8, bpm: 120 }), 8)
  })
})

describe('timelinePhase', () => {
  it('wraps phase when looping', () => {
    const mid = timelinePhase(4, 8, true)
    assert.equal(mid.phase, 0.5)
    assert.equal(mid.loopIndex, 0)

    const wrap = timelinePhase(8, 8, true)
    assert.equal(wrap.phase, 0)
    assert.equal(wrap.loopIndex, 1)
  })

  it('clamps phase when not looping', () => {
    const start = timelinePhase(0, 8, false)
    assert.equal(start.phase, 0)

    const end = timelinePhase(12, 8, false)
    assert.equal(end.phase, 1)
    assert.equal(end.loopIndex, 1)
  })

  it('handles zero loop beats', () => {
    assert.deepEqual(timelinePhase(5, 0, true), { phase: 0, loopIndex: 0 })
  })
})

describe('detectLoopPeriod with Timeline', () => {
  it('prefers Timeline over other periodic nodes', () => {
    const result = detectLoopPeriod(
      graph([
        {
          id: 'tl',
          type: TIMELINE_NODE_TYPE,
          position: { x: 0, y: 0 },
          params: { durationSec: 6, bpm: 120, loop: true }
        },
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
    assert.equal(result.periodSec, 6)
    assert.deepEqual(result.sources, ['Timeline'])
  })

  it('falls back to LCM when no looping Timeline exists', () => {
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
  })

  it('ignores Timeline when loop is off', () => {
    const result = detectLoopPeriod(
      graph([
        {
          id: 'tl',
          type: TIMELINE_NODE_TYPE,
          position: { x: 0, y: 0 },
          params: { durationSec: 6, bpm: 120, loop: false }
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
  })
})

describe('timelineExportWarnings', () => {
  it('warns when multiple timelines disagree', () => {
    const warnings = timelineExportWarnings(
      graph([
        {
          id: 'tl1',
          type: TIMELINE_NODE_TYPE,
          position: { x: 0, y: 0 },
          label: 'Main',
          params: { durationSec: 8, bpm: 120, loop: true }
        },
        {
          id: 'tl2',
          type: TIMELINE_NODE_TYPE,
          position: { x: 0, y: 0 },
          params: { durationSec: 6, bpm: 120, loop: true }
        }
      ])
    )
    assert.equal(warnings.length, 1)
    assert.match(warnings[0]!, /Main/)
  })

  it('is silent for a single timeline', () => {
    const warnings = timelineExportWarnings(
      graph([
        {
          id: 'tl1',
          type: TIMELINE_NODE_TYPE,
          position: { x: 0, y: 0 },
          params: { durationSec: 8, bpm: 120, loop: true }
        }
      ])
    )
    assert.equal(warnings.length, 0)
  })
})

describe('upstreamNodeIds', () => {
  it('includes only nodes feeding the output', () => {
    const g = graph([
      {
        id: 'tl',
        type: TIMELINE_NODE_TYPE,
        position: { x: 0, y: 0 },
        params: { durationSec: 8, bpm: 120, loop: true }
      },
      {
        id: 'lfo',
        type: 'time/lfo',
        position: { x: 0, y: 0 },
        params: { frequency: 0.25 }
      },
      {
        id: 'solid',
        type: 'generator/solid-colour',
        position: { x: 0, y: 0 },
        params: {}
      },
      {
        id: 'out',
        type: 'output/pixel',
        position: { x: 0, y: 0 },
        params: {}
      }
    ])
    g.edges.push({
      id: 'e1',
      fromNode: 'solid',
      fromPort: 'pixels',
      toNode: 'out',
      toPort: 'pixels'
    })
    const reachable = upstreamNodeIds(g)
    assert.ok(reachable.has('solid'))
    assert.ok(reachable.has('out'))
    assert.equal(reachable.has('lfo'), false)
    assert.equal(reachable.has('tl'), false)
  })
})

describe('detectLoopPeriod reachable scope', () => {
  it('ignores unreachable oscillators when Timeline is absent', () => {
    const g = graph([
      {
        id: 'lfo',
        type: 'time/lfo',
        position: { x: 0, y: 0 },
        params: { frequency: 0.25 }
      },
      {
        id: 'g1',
        type: 'generator/gradient',
        position: { x: 0, y: 0 },
        params: { speed: 0.5 }
      },
      {
        id: 'solid',
        type: 'generator/solid-colour',
        position: { x: 0, y: 0 },
        params: {}
      },
      {
        id: 'out',
        type: 'output/pixel',
        position: { x: 0, y: 0 },
        params: {}
      }
    ])
    g.edges.push({
      id: 'e1',
      fromNode: 'solid',
      fromPort: 'pixels',
      toNode: 'out',
      toPort: 'pixels'
    })
    const result = detectLoopPeriod(g)
    assert.equal(result.periodSec, null)
  })
})

describe('bakeExportWarnings', () => {
  it('warns about multiple outputs', () => {
    const warnings = bakeExportWarnings(
      graph([
        { id: 'o1', type: 'output/pixel', position: { x: 0, y: 0 }, params: {} },
        { id: 'o2', type: 'output/pixel', position: { x: 0, y: 0 }, params: {} }
      ])
    )
    assert.equal(warnings.length, 1)
    assert.match(warnings[0]!, /Multiple Pixel Output/)
  })
})
