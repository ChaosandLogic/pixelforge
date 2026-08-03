import { applyIntensity, clamp01, colour01, mixRgb } from './math'
import type { ShaderPreset } from './types'

/** Radial tunnel / zoom vortex. */
export const tunnel: ShaderPreset = {
  id: 'tunnel',
  label: 'Tunnel',
  glsl: `void main() {
  vec2 uv = (v_uv - 0.5) * u_scale;
  float r = length(uv) + 1e-4;
  float a = atan(uv.y, uv.x);
  float z = 1.0 / r + u_time * 0.8;
  float rings = sin(z * 6.0 + a * 3.0) * 0.5 + 0.5;
  float spokes = sin(a * 8.0 - u_time) * 0.5 + 0.5;
  float v = mix(rings, spokes, 0.35);
  v *= smoothstep(0.0, 0.15, r);
  vec3 col = mix(u_colourA, u_colourB, v);
  fragColor = vec4(col * u_intensity, 1.0);
}`,
  cpuSample(u, v, time, uniforms) {
    const ca = colour01(uniforms.colourA)
    const cb = colour01(uniforms.colourB)
    const scale = uniforms.scale
    const x = (u - 0.5) * scale
    const y = (v - 0.5) * scale
    const r = Math.sqrt(x * x + y * y) + 1e-4
    const a = Math.atan2(y, x)
    const z = 1 / r + time * 0.8
    const rings = Math.sin(z * 6 + a * 3) * 0.5 + 0.5
    const spokes = Math.sin(a * 8 - time) * 0.5 + 0.5
    let w = rings * 0.65 + spokes * 0.35
    const edge = clamp01(r / 0.15)
    w *= edge
    return applyIntensity(mixRgb(ca, cb, clamp01(w)), uniforms.intensity)
  }
}
