import {
  beginScopedOutput,
  generatorScope,
  scopePatchIndex,
  scopeUv
} from '../../generatorScope'
import {
  DEFAULT_SHADER_PRESET_ID,
  SHADER_PRESET_IDS,
  sampleShaderPreset,
  type ShaderUniforms
} from '../../shaders/presets'
import {
  colourParam,
  floatInput,
  floatParam,
  stringParam,
  type NodeTypeDef
} from '../../types'

export const SHADER_NODE_TYPE = 'generator/shader'

/**
 * Curated 2D shader presets. Live Editor/Player push WebGL frames via
 * media-frame; evaluate falls back to CPU samplers for headless / bake.
 */
export const Shader: NodeTypeDef = {
  type: SHADER_NODE_TYPE,
  label: 'Shader',
  category: 'generator',
  description: '2D GLSL presets (plasma, tunnel, ripples, …) mapped across pixels',
  inputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' },
    { name: 'phase', label: 'Phase', type: 'float' }
  ],
  outputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  params: [
    {
      name: 'preset',
      label: 'Preset',
      type: 'select',
      default: DEFAULT_SHADER_PRESET_ID,
      options: [...SHADER_PRESET_IDS]
    },
    { name: 'speed', label: 'Speed', type: 'float', default: 1, min: -5, max: 5, step: 0.05 },
    { name: 'scale', label: 'Scale', type: 'float', default: 1, min: 0.1, max: 8, step: 0.05 },
    {
      name: 'colourA',
      label: 'Colour A',
      type: 'colour',
      default: { r: 10, g: 20, b: 80 }
    },
    {
      name: 'colourB',
      label: 'Colour B',
      type: 'colour',
      default: { r: 0, g: 220, b: 180 }
    },
    { name: 'intensity', label: 'Intensity', type: 'float', default: 1, min: 0, max: 2, step: 0.01 }
  ],
  evaluate(inputs, params, ctx) {
    const scope = generatorScope(inputs, ctx)
    const out = beginScopedOutput(ctx)
    const preset = stringParam(params, 'preset', DEFAULT_SHADER_PRESET_ID)
    const speed = floatParam(params, 'speed', 1)
    const phase = floatInput(inputs, params, 'phase', floatParam(params, 'phase', 0))
    const time = (ctx.timeMs / 1000) * speed + phase

    const uniforms: ShaderUniforms = {
      scale: floatParam(params, 'scale', 1),
      colourA: colourParam(params, 'colourA'),
      colourB: colourParam(params, 'colourB'),
      intensity: floatParam(params, 'intensity', 1)
    }

    const frame = ctx.getMediaFrame(ctx.nodeId)
    if (frame !== null && frame.width > 0 && frame.height > 0) {
      const { width, height, data } = frame
      for (let i = 0; i < scope.count; i++) {
        const { u, v } = scopeUv(ctx.positions, i, scope)
        const fx = Math.min(width - 1, Math.max(0, Math.round(u * (width - 1))))
        const fy = Math.min(height - 1, Math.max(0, Math.round(v * (height - 1))))
        const idx = (fy * width + fx) * 3
        const dst = scopePatchIndex(scope, i) * 3
        out[dst] = (data[idx] ?? 0) / 255
        out[dst + 1] = (data[idx + 1] ?? 0) / 255
        out[dst + 2] = (data[idx + 2] ?? 0) / 255
      }
      return { pixels: out }
    }

    for (let i = 0; i < scope.count; i++) {
      const { u, v } = scopeUv(ctx.positions, i, scope)
      const rgb = sampleShaderPreset(preset, u, v, time, uniforms)
      const dst = scopePatchIndex(scope, i) * 3
      out[dst] = rgb.r
      out[dst + 1] = rgb.g
      out[dst + 2] = rgb.b
    }
    return { pixels: out }
  }
}
