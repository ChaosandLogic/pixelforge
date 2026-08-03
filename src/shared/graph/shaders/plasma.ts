import { applyIntensity, clamp01, colour01, mixRgb } from './math'
import type { ShaderPreset } from './types'

/** Classic multi-sine plasma. */
export const plasma: ShaderPreset = {
  id: 'plasma',
  label: 'Plasma',
  glsl: `void main() {
  vec2 uv = (v_uv - 0.5) * u_scale + 0.5;
  float t = u_time;
  float v = sin(uv.x * 10.0 + t);
  v += sin(uv.y * 10.0 + t * 1.3);
  v += sin((uv.x + uv.y) * 8.0 + t * 0.7);
  v += sin(length(uv - 0.5) * 16.0 - t * 2.0);
  v = v * 0.25 + 0.5;
  vec3 col = mix(u_colourA, u_colourB, clamp(v, 0.0, 1.0));
  fragColor = vec4(col * u_intensity, 1.0);
}`,
  cpuSample(u, v, time, uniforms) {
    const a = colour01(uniforms.colourA)
    const b = colour01(uniforms.colourB)
    const scale = uniforms.scale
    const x = (u - 0.5) * scale + 0.5
    const y = (v - 0.5) * scale + 0.5
    const t = time
    let n = Math.sin(x * 10 + t)
    n += Math.sin(y * 10 + t * 1.3)
    n += Math.sin((x + y) * 8 + t * 0.7)
    const dx = x - 0.5
    const dy = y - 0.5
    n += Math.sin(Math.sqrt(dx * dx + dy * dy) * 16 - t * 2)
    const w = clamp01(n * 0.25 + 0.5)
    return applyIntensity(mixRgb(a, b, w), uniforms.intensity)
  }
}
