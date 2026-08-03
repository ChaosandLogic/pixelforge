import { aurora } from './aurora'
import { checkerWarp } from './checkerWarp'
import { plasma } from './plasma'
import { ripples } from './ripples'
import { spiral } from './spiral'
import { tunnel } from './tunnel'
import type { ShaderPreset, ShaderUniforms } from './types'

export type { ShaderPreset, ShaderUniforms, CpuRgb } from './types'

export const SHADER_PRESETS: readonly ShaderPreset[] = [
  plasma,
  tunnel,
  ripples,
  spiral,
  checkerWarp,
  aurora
]

export const SHADER_PRESET_IDS = SHADER_PRESETS.map((p) => p.id)

export const SHADER_PRESET_BY_ID: ReadonlyMap<string, ShaderPreset> = new Map(
  SHADER_PRESETS.map((p) => [p.id, p])
)

export const DEFAULT_SHADER_PRESET_ID = plasma.id

export function getShaderPreset(id: string): ShaderPreset {
  return SHADER_PRESET_BY_ID.get(id) ?? plasma
}

export function sampleShaderPreset(
  presetId: string,
  u: number,
  v: number,
  time: number,
  uniforms: ShaderUniforms
): { r: number; g: number; b: number } {
  return getShaderPreset(presetId).cpuSample(u, v, time, uniforms)
}
