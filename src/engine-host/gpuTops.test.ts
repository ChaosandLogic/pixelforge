import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { describe, it } from 'node:test'
import { join } from 'node:path'
import { registerStandardNodes, OUTPUT_NODE_TYPE } from '../shared/graph/nodes'
import type { GraphData } from '../shared/graph/types'
import { BufferPool } from './evaluator/BufferPool'
import { Evaluator } from './evaluator/Evaluator'
import { GpuClient } from './gpu/GpuClient'

registerStandardNodes()

function linePositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = count > 1 ? i / (count - 1) : 0
    positions[i * 3 + 1] = 0.5
  }
  return positions
}

function solidGraph(): GraphData {
  return {
    nodes: [
      {
        id: 'solid',
        type: 'generator/solid-colour',
        position: { x: 0, y: 0 },
        params: { colour: { r: 255, g: 80, b: 0 } }
      },
      {
        id: 'out',
        type: OUTPUT_NODE_TYPE,
        position: { x: 0, y: 0 },
        params: {}
      }
    ],
    edges: [{ id: 'e1', fromNode: 'solid', fromPort: 'pixels', toNode: 'out', toPort: 'pixels' }]
  }
}

function gpuBinary(): string | null {
  const name = process.platform === 'win32' ? 'gpu-engine.exe' : 'gpu-engine'
  const path = join(process.cwd(), 'gpu-engine', 'target', 'release', name)
  return existsSync(path) ? path : null
}

describe('GPU TOP evaluator', () => {
  it('CPU solid colour fills the patch', () => {
    const n = 8
    const sab = new SharedArrayBuffer(n * 3)
    const evaluator = new Evaluator(sab, n, new BufferPool(n))
    evaluator.setPatch(linePositions(n), n, n, 1, [])
    evaluator.setGraph(solidGraph())
    const view = new Uint8Array(sab)
    evaluator.setOutputTargets(['out'], new Map([['out', view]]), view)
    evaluator.evaluate(0, 16)
    assert.equal(view[0], 255)
    assert.equal(view[1], 80)
    assert.equal(view[2], 0)
  })

  it('GPU solid colour matches CPU when sidecar is available', () => {
    const bin = gpuBinary()
    if (bin === null) return
    const n = 8
    const cpuSab = new SharedArrayBuffer(n * 3)
    const gpuSab = new SharedArrayBuffer(n * 3)
    const graph = solidGraph()
    const cpu = new Evaluator(cpuSab, n, new BufferPool(n))
    cpu.setPatch(linePositions(n), n, n, 1, [])
    cpu.setGraph(graph)
    const cpuView = new Uint8Array(cpuSab)
    cpu.setOutputTargets(['out'], new Map([['out', cpuView]]), cpuView)
    cpu.evaluate(0, 16)

    const gpuEval = new Evaluator(gpuSab, n, new BufferPool(n))
    const client = new GpuClient(bin)
    assert.equal(client.start(), true)
    try {
      gpuEval.setGpuClient(client)
      gpuEval.setPatch(linePositions(n), n, n, 1, [])
      gpuEval.setGraph(graph)
      const gpuView = new Uint8Array(gpuSab)
      gpuEval.setOutputTargets(['out'], new Map([['out', gpuView]]), gpuView)
      gpuEval.evaluate(0, 16)
      assert.equal(gpuEval.evalError, null)
      assert.deepEqual([...gpuView], [...cpuView])
    } finally {
      client.stop()
    }
  })

  it('GPU mix of two solids is non-black', () => {
    const bin = gpuBinary()
    if (bin === null) return
    const n = 8
    const sab = new SharedArrayBuffer(n * 3)
    const evaluator = new Evaluator(sab, n, new BufferPool(n))
    const client = new GpuClient(bin)
    assert.equal(client.start(), true)
    try {
      evaluator.setGpuClient(client)
      evaluator.setPatch(linePositions(n), n, 8, 1, [])
      evaluator.setGraph({
        nodes: [
          {
            id: 'a',
            type: 'generator/solid-colour',
            position: { x: 0, y: 0 },
            params: { colour: { r: 255, g: 0, b: 0 } }
          },
          {
            id: 'b',
            type: 'generator/solid-colour',
            position: { x: 0, y: 0 },
            params: { colour: { r: 0, g: 0, b: 255 } }
          },
          {
            id: 'mix',
            type: 'composite/mix',
            position: { x: 0, y: 0 },
            params: { mode: 'mix', amount: 0.5 }
          },
          { id: 'out', type: OUTPUT_NODE_TYPE, position: { x: 0, y: 0 }, params: {} }
        ],
        edges: [
          { id: 'e1', fromNode: 'a', fromPort: 'pixels', toNode: 'mix', toPort: 'a' },
          { id: 'e2', fromNode: 'b', fromPort: 'pixels', toNode: 'mix', toPort: 'b' },
          { id: 'e3', fromNode: 'mix', fromPort: 'pixels', toNode: 'out', toPort: 'pixels' }
        ]
      })
      const view = new Uint8Array(sab)
      evaluator.setOutputTargets(['out'], new Map([['out', view]]), view)
      evaluator.evaluate(0, 16)
      assert.equal(evaluator.evalError, null)
      assert.ok((view[0] ?? 0) > 0 || (view[2] ?? 0) > 0)
    } finally {
      client.stop()
    }
  })
})
