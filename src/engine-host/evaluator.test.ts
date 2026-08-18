import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { registerStandardNodes, OUTPUT_NODE_TYPE } from '../shared/graph/nodes'
import { TIMELINE_NODE_TYPE } from '../shared/graph/nodes/time/Timeline'
import type { GraphData } from '../shared/graph/types'
import { EFFECT_PREVIEW_EVAL_SIZE } from '../shared/preview/effectPreviewGrid'
import { NODE_PREVIEW_SIZE } from '../shared/preview/displaySize'
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

  it('effect preview is a square field, not the patch raster', () => {
    const pixelCount = 8
    const sab = new SharedArrayBuffer(pixelCount * 3)
    const evaluator = new Evaluator(sab, pixelCount, new BufferPool(pixelCount))
    evaluator.setPatch(linePositions(pixelCount), pixelCount, pixelCount, 1, [])
    evaluator.setGraph({
      nodes: [
        {
          id: 'noise',
          type: 'generator/noise',
          position: { x: 0, y: 0 },
          params: {
            colourA: { r: 10, g: 0, b: 40 },
            colourB: { r: 255, g: 40, b: 120 }
          }
        },
        {
          id: 'out',
          type: OUTPUT_NODE_TYPE,
          position: { x: 0, y: 0 },
          params: {}
        }
      ],
      edges: [
        { id: 'e1', fromNode: 'noise', fromPort: 'pixels', toNode: 'out', toPort: 'pixels' }
      ]
    })
    const view = new Uint8Array(sab)
    evaluator.setOutputTargets(['out'], new Map([['out', view]]), view)
    evaluator.evaluate(0, 16)
    assert.equal(evaluator.evalError, null)

    const preview = evaluator.previews['noise']
    assert.equal(preview?.kind, 'pixels')
    if (preview?.kind !== 'pixels') return
    assert.equal(preview.width, EFFECT_PREVIEW_EVAL_SIZE)
    assert.equal(preview.height, EFFECT_PREVIEW_EVAL_SIZE)
    assert.equal(preview.layout?.width, NODE_PREVIEW_SIZE)
    assert.equal(preview.layout?.height, NODE_PREVIEW_SIZE)

    let unique = 0
    const seen = new Set<number>()
    for (let i = 0; i < preview.data.length; i += 3) {
      const key = (preview.data[i] ?? 0) * 65536 + (preview.data[i + 1] ?? 0) * 256 + (preview.data[i + 2] ?? 0)
      if (!seen.has(key)) {
        seen.add(key)
        unique += 1
      }
    }
    assert.ok(unique > 8, `effect preview should vary in 2D, got ${unique} colours`)
  })

  it('animates every noise type over time', () => {
    const types = ['value2d', 'value3d', 'perlin3d', 'perlin4d-time', 'perlin4d-space'] as const
    const pixelCount = 16
    for (const noiseType of types) {
      const sab = new SharedArrayBuffer(pixelCount * 3)
      const evaluator = new Evaluator(sab, pixelCount, new BufferPool(pixelCount))
      evaluator.setPatch(linePositions(pixelCount), pixelCount, pixelCount, 1, [])
      evaluator.setGraph({
        nodes: [
          {
            id: 'noise',
            type: 'generator/noise',
            position: { x: 0, y: 0 },
            params: {
              noiseType,
              speed: 1,
              scale: 5,
              wScale: 0.4,
              colourA: { r: 0, g: 0, b: 0 },
              colourB: { r: 255, g: 255, b: 255 }
            }
          },
          {
            id: 'out',
            type: OUTPUT_NODE_TYPE,
            position: { x: 0, y: 0 },
            params: {}
          }
        ],
        edges: [{ id: 'e1', fromNode: 'noise', fromPort: 'pixels', toNode: 'out', toPort: 'pixels' }]
      })
      const view = new Uint8Array(sab)
      evaluator.setOutputTargets(['out'], new Map([['out', view]]), view)
      evaluator.evaluate(0, 16)
      const first = new Uint8Array(view)
      evaluator.evaluate(2500, 16)
      let changed = 0
      for (let i = 0; i < view.length; i++) {
        if (view[i] !== first[i]) changed += 1
      }
      assert.ok(changed > 0, `${noiseType} should change over time`)
    }
  })
})
