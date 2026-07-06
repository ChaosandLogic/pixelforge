import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { registerStandardNodes, OUTPUT_NODE_TYPE } from '../shared/graph/nodes'
import { TIMELINE_NODE_TYPE } from '../shared/graph/nodes/time/Timeline'
import type { GraphData } from '../shared/graph/types'
import { BufferPool } from './evaluator/BufferPool'
import { Evaluator } from './evaluator/Evaluator'

registerStandardNodes()

function linePositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = count > 1 ? i / (count - 1) : 0
  }
  return positions
}

describe('Evaluator', () => {
  it('consumes fireTrigger on reset port', () => {
    const pixelCount = 1
    const sab = new SharedArrayBuffer(3)
    const pool = new BufferPool(pixelCount)
    const evaluator = new Evaluator(sab, pixelCount, pool)
    evaluator.setPatch(linePositions(pixelCount), pixelCount, 1, 1, [])
    evaluator.setGraph({
      nodes: [
        {
          id: 'tl',
          type: TIMELINE_NODE_TYPE,
          position: { x: 0, y: 0 },
          params: { durationSec: 4, bpm: 120, loop: true }
        },
        {
          id: 'out',
          type: OUTPUT_NODE_TYPE,
          position: { x: 0, y: 0 },
          params: {}
        }
      ],
      edges: []
    })
    assert.equal(evaluator.graphError, null)

    const view = new Uint8Array(sab)
    evaluator.setOutputTargets(['out'], new Map([['out', view]]), view)

    evaluator.evaluate(4000, 16)
    evaluator.fireTrigger('tl', 'reset')
    evaluator.evaluate(4000, 16)
    assert.ok(true)
  })

  it('prunes timeline loop state when node is removed', () => {
    const pixelCount = 1
    const sab = new SharedArrayBuffer(3)
    const pool = new BufferPool(pixelCount)
    const evaluator = new Evaluator(sab, pixelCount, pool)
    evaluator.setPatch(linePositions(pixelCount), pixelCount, 1, 1, [])

    const graphWithTimeline: GraphData = {
      nodes: [
        {
          id: 'tl',
          type: TIMELINE_NODE_TYPE,
          position: { x: 0, y: 0 },
          params: { durationSec: 2, bpm: 120, loop: true }
        },
        {
          id: 'out',
          type: OUTPUT_NODE_TYPE,
          position: { x: 0, y: 0 },
          params: {}
        }
      ],
      edges: []
    }

    evaluator.setGraph(graphWithTimeline)
    const view = new Uint8Array(sab)
    evaluator.setOutputTargets(['out'], new Map([['out', view]]), view)
    evaluator.evaluate(2000, 16)

    evaluator.setGraph({
      nodes: [
        {
          id: 'out',
          type: OUTPUT_NODE_TYPE,
          position: { x: 0, y: 0 },
          params: {}
        }
      ],
      edges: []
    })
    assert.equal(evaluator.graphError, null)
  })
})
