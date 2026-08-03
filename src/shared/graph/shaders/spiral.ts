import { applyIntensity, clamp01, colour01, mixRgb } from './math'
import type { ShaderPreset } from './types'

/** Rotating spiral arms. */
export const spiral: ShaderPreset = {
  id: 'spiral',
  label: 'Spiral',
  glsl: `void main() {
  vec2 uv = (v_uv - 0.5) * u_scale;
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float arms = sin(a * 5.0 - r * 18.0 + u_time * 3.0) * 0.5 + 0.5;
  float glow = exp(-r * 2.2);
  float v = arms * glow;
  vec3 col = mix(u_colourA, u_colourB, v);
  fragColor = vec4(col * u_intensity, 1.0);
}`,
  cpuSample(u, v, time, uniforms) {
    const ca = colour01(uniforms.colourA)
    const cb = colour01(uniforms.colourB)
    const scale = uniforms.scale
    const x = (u - 0.5) * scale
    const y = (v - 0.5) * scale
    const r = Math.sqrt(x * x + y * y)
    const a = Math.atan2(y, x)
    const arms = Math.sin(a * 5 - r * 18 + time * 3) * 0.5 + 0.5
    const glow = Math.exp(-r * 2.2)
    const w = clamp01(arms * glow)
    return applyIntensity(mixRgb(ca, cb, w), uniforms.intensity)
  }
}
