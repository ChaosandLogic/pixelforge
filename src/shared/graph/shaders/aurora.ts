import { applyIntensity, clamp01, colour01, mix, mixRgb } from './math'
import type { ShaderPreset } from './types'

/** Soft drifting aurora bands. */
export const aurora: ShaderPreset = {
  id: 'aurora',
  label: 'Aurora',
  glsl: `void main() {
  vec2 uv = (v_uv - 0.5) * u_scale + 0.5;
  float band = sin(uv.x * 4.0 + u_time * 0.6) * 0.15
             + sin(uv.x * 9.0 - u_time * 0.4) * 0.08;
  float y = uv.y + band;
  float curtain = smoothstep(0.15, 0.45, y) * (1.0 - smoothstep(0.55, 0.9, y));
  float shimmer = sin(uv.x * 20.0 + u_time * 2.0 + y * 10.0) * 0.5 + 0.5;
  float v = curtain * mix(0.4, 1.0, shimmer);
  vec3 col = mix(u_colourA, u_colourB, v);
  fragColor = vec4(col * u_intensity, 1.0);
}`,
  cpuSample(u, v, time, uniforms) {
    const ca = colour01(uniforms.colourA)
    const cb = colour01(uniforms.colourB)
    const scale = uniforms.scale
    const x = (u - 0.5) * scale + 0.5
    const y0 = (v - 0.5) * scale + 0.5
    const band = Math.sin(x * 4 + time * 0.6) * 0.15 + Math.sin(x * 9 - time * 0.4) * 0.08
    const y = y0 + band
    const smoothstep = (e0: number, e1: number, x: number): number => {
      const t = clamp01((x - e0) / (e1 - e0))
      return t * t * (3 - 2 * t)
    }
    const curtain = smoothstep(0.15, 0.45, y) * (1 - smoothstep(0.55, 0.9, y))
    const shimmer = Math.sin(x * 20 + time * 2 + y * 10) * 0.5 + 0.5
    const w = clamp01(curtain * mix(0.4, 1, shimmer))
    return applyIntensity(mixRgb(ca, cb, w), uniforms.intensity)
  }
}
