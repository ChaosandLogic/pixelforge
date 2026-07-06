import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { registerStandardNodes } from '../shared/graph/nodes'
import { OUTPUT_NODE_TYPE } from '../shared/graph/nodes'
import { bakeFrames } from './bake'
import { measureLoopSeam } from '../shared/export/loopSeam'

registerStandardNodes()

function solidColourGraph(): { nodes: import('../shared/graph/types').GraphData['nodes']; edges: import('../shared/graph/types').GraphData['edges'] } {
  return {
    nodes: [
      {
        id: 'solid',
        type: 'generator/solid-colour',
        position: { x: 0, y: 0 },
        params: { colour: { r: 255, g: 0, b: 0 } }
      },
      {
        id: 'out',
        type: OUTPUT_NODE_TYPE,
        position: { x: 0, y: 0 },
        params: {}
      }
    ],
    edges: [
      {
        id: 'e1',
        fromNode: 'solid',
        fromPort: 'pixels',
        toNode: 'out',
        toPort: 'pixels'
      }
    ]
  }
}

describe('bakeFrames', () => {
  it('bakes a solid colour graph', () => {
    const { nodes, edges } = solidColourGraph()
    const result = bakeFrames({
      graph: { nodes, edges },
      positions: new Float32Array([0, 0, 0]),
      pixelCount: 1,
      resolutionWidth: 1,
      resolutionHeight: 1,
      fixtureRanges: [],
      mediaFrames: new Map(),
      audioLevels: new Map(),
      durationMs: 1000,
      fps: 10
    })

    assert.equal(result.error, null)
    assert.equal(result.frameCount, 10)
    assert.equal(result.pixelCount, 1)
    assert.equal(result.frames.length, 10 * 3)
    assert.equal(result.frames[0], 255)
  })

  it('reports perfect loop seam for static colour', () => {
    const { nodes, edges } = solidColourGraph()
    const result = bakeFrames({
      graph: { nodes, edges },
      positions: new Float32Array([0, 0, 0]),
      pixelCount: 1,
      resolutionWidth: 1,
      resolutionHeight: 1,
      fixtureRanges: [],
      mediaFrames: new Map(),
      audioLevels: new Map(),
      durationMs: 500,
      fps: 10
    })
    assert.equal(result.error, null)
    assert.ok(result.seamFrame !== null)
    assert.equal(result.seamFrame!.length, result.pixelCount * 3)
    const seam = measureLoopSeam(
      result.frames,
      result.frameCount,
      result.pixelCount,
      result.seamFrame
    )
    assert.equal(seam.matchPercent, 100)
  })

  it('guard frame closes the seam for a one-period scroll', () => {
    // A gradient scrolling one full phase per second, baked over exactly 1 s,
    // wraps cleanly: the guard frame (t=1s) equals frame 0, even though the last
    // baked frame (t=0.9s) is mid-scroll.
    const pixelCount = 8
    const positions = new Float32Array(pixelCount * 3)
    for (let i = 0; i < pixelCount; i++) positions[i * 3] = i
    const result = bakeFrames({
      graph: {
        nodes: [
          {
            id: 'grad',
            type: 'generator/gradient',
            position: { x: 0, y: 0 },
            params: { speed: 1, axis: 'x' }
          },
          { id: 'out', type: OUTPUT_NODE_TYPE, position: { x: 0, y: 0 }, params: {} }
        ],
        edges: [
          { id: 'e1', fromNode: 'grad', fromPort: 'pixels', toNode: 'out', toPort: 'pixels' }
        ]
      },
      positions,
      pixelCount,
      resolutionWidth: pixelCount,
      resolutionHeight: 1,
      fixtureRanges: [],
      mediaFrames: new Map(),
      audioLevels: new Map(),
      durationMs: 1000,
      fps: 10
    })

    assert.equal(result.error, null)
    const guarded = measureLoopSeam(result.frames, result.frameCount, result.pixelCount, result.seamFrame)
    const lastFrame = measureLoopSeam(result.frames, result.frameCount, result.pixelCount)
    // The guard-frame seam is a strict improvement over the last-frame estimate.
    assert.ok(guarded.meanDelta <= lastFrame.meanDelta)
    assert.ok(guarded.meanDelta < 1)
  })

  it('still bakes frames when output is not wired to a generator', () => {
    const result = bakeFrames({
      graph: {
        nodes: [
          {
            id: 'solid',
            type: 'generator/solid-colour',
            position: { x: 0, y: 0 },
            params: { colour: { r: 0, g: 0, b: 0 } }
          }
        ],
        edges: []
      },
      positions: new Float32Array([0, 0, 0]),
      pixelCount: 1,
      resolutionWidth: 1,
      resolutionHeight: 1,
      fixtureRanges: [],
      mediaFrames: new Map(),
      audioLevels: new Map(),
      durationMs: 100,
      fps: 10
    })
    assert.equal(result.frameCount, 1)
    assert.equal(result.error, null)
  })
})
