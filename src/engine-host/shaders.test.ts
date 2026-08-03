import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { registerStandardNodes, OUTPUT_NODE_TYPE } from '../shared/graph/nodes'
import { SHADER_NODE_TYPE } from '../shared/graph/nodes/generators/Shader'
import {
  DEFAULT_SHADER_PRESET_ID,
  SHADER_PRESET_IDS,
  SHADER_PRESETS,
  getShaderPreset,
  sampleShaderPreset
} from '../shared/graph/shaders/presets'
import type { ShaderUniforms } from '../shared/graph/shaders/types'
import { getNodeType } from '../shared/graph/registry'
import { BufferPool } from './evaluator/BufferPool'
import { Evaluator } from './evaluator/Evaluator'

registerStandardNodes()

const uniforms: ShaderUniforms = {
  scale: 1,
  colourA: { r: 10, g: 20, b: 80 },
  colourB: { r: 0, g: 220, b: 180 },
  intensity: 1
}

function linePositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = count > 1 ? i / (count - 1) : 0
    positions[i * 3 + 1] = 0.5
  }
  return positions
}

describe('shader presets', () => {
  it('registers six curated presets', () => {
    assert.equal(SHADER_PRESETS.length, 6)
    assert.deepEqual(SHADER_PRESET_IDS, [
      'plasma',
      'tunnel',
      'ripples',
      'spiral',
      'checker-warp',
      'aurora'
    ])
    assert.equal(DEFAULT_SHADER_PRESET_ID, 'plasma')
  })

  it('cpuSample returns finite RGB in 0..1 for every preset', () => {
    for (const preset of SHADER_PRESETS) {
      const rgb = preset.cpuSample(0.25, 0.75, 1.25, uniforms)
      assert.ok(Number.isFinite(rgb.r), preset.id)
      assert.ok(Number.isFinite(rgb.g), preset.id)
      assert.ok(Number.isFinite(rgb.b), preset.id)
      assert.ok(rgb.r >= 0 && rgb.r <= 1, `${preset.id} r`)
      assert.ok(rgb.g >= 0 && rgb.g <= 1, `${preset.id} g`)
      assert.ok(rgb.b >= 0 && rgb.b <= 1, `${preset.id} b`)
    }
  })

  it('plasma is stable at a fixed sample point', () => {
    const a = sampleShaderPreset('plasma', 0.5, 0.5, 0, uniforms)
    const b = sampleShaderPreset('plasma', 0.5, 0.5, 0, uniforms)
    assert.deepEqual(a, b)
    assert.ok(a.r + a.g + a.b > 0.01)
  })

  it('falls back to plasma for unknown preset ids', () => {
    assert.equal(getShaderPreset('nope').id, 'plasma')
  })

  it('embeds non-empty GLSL bodies', () => {
    for (const preset of SHADER_PRESETS) {
      assert.ok(preset.glsl.includes('void main()'), preset.id)
      assert.ok(preset.glsl.includes('fragColor'), preset.id)
    }
  })
})

describe('generator/shader node', () => {
  it('is registered with default params', () => {
    const def = getNodeType(SHADER_NODE_TYPE)
    assert.ok(def)
    assert.equal(def?.label, 'Shader')
    const presetParam = def?.params.find((p) => p.name === 'preset')
    assert.ok(presetParam && presetParam.type === 'select')
    if (presetParam?.type === 'select') {
      assert.deepEqual(presetParam.options, [...SHADER_PRESET_IDS])
    }
  })

  it('evaluates non-black plasma without a media-frame', () => {
    const pixelCount = 8
    const sab = new SharedArrayBuffer(pixelCount * 3)
    const pool = new BufferPool(pixelCount)
    const evaluator = new Evaluator(sab, pixelCount, pool)
    evaluator.setPatch(linePositions(pixelCount), pixelCount, pixelCount, 1, [])
    evaluator.setGraph({
      nodes: [
        {
          id: 'sh',
          type: SHADER_NODE_TYPE,
          position: { x: 0, y: 0 },
          params: {
            preset: 'plasma',
            speed: 1,
            scale: 1,
            colourA: { r: 10, g: 20, b: 80 },
            colourB: { r: 0, g: 220, b: 180 },
            intensity: 1
          }
        },
        {
          id: 'out',
          type: OUTPUT_NODE_TYPE,
          position: { x: 100, y: 0 },
          params: {}
        }
      ],
      edges: [
        {
          id: 'e0',
          fromNode: 'sh',
          fromPort: 'pixels',
          toNode: 'out',
          toPort: 'pixels'
        }
      ]
    })
    assert.equal(evaluator.graphError, null)

    const view = new Uint8Array(sab)
    evaluator.setOutputTargets(['out'], new Map([['out', view]]), view)
    evaluator.evaluate(1000, 16)

    let sum = 0
    for (let i = 0; i < view.length; i++) sum += view[i] ?? 0
    assert.ok(sum > 0, 'expected non-black plasma output')
  })
})
