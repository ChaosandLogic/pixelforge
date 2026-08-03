import { applyIntensity, clamp01, colour01, mixRgb } from './math'
import type { ShaderPreset } from './types'

/** Expanding circular ripples from centre. */
export const ripples: ShaderPreset = {
  id: 'ripples',
  label: 'Ripples',
  glsl: `void main() {
  vec2 uv = (v_uv - 0.5) * u_scale;
  float d = length(uv);
  float wave = sin(d * 28.0 - u_time * 6.0);
  float envelope = exp(-d * 3.5);
  float v = wave * 0.5 + 0.5;
  v = mix(0.15, v, envelope);
  vec3 col = mix(u_colourA, u_colourB, v);
  fragColor = vec4(col * u_intensity, 1.0);
}`,
  cpuSample(u, v, time, uniforms) {
    const ca = colour01(uniforms.colourA)
    const cb = colour01(uniforms.colourB)
    const scale = uniforms.scale
    const x = (u - 0.5) * scale
    const y = (v - 0.5) * scale
    const d = Math.sqrt(x * x + y * y)
    const wave = Math.sin(d * 28 - time * 6)
    const envelope = Math.exp(-d * 3.5)
    let w = wave * 0.5 + 0.5
    w = 0.15 + (w - 0.15) * envelope
    return applyIntensity(mixRgb(ca, cb, clamp01(w)), uniforms.intensity)
  }
}
