import { applyIntensity, colour01, mixRgb } from './math'
import type { ShaderPreset } from './types'

/** Warped checkerboard. */
export const checkerWarp: ShaderPreset = {
  id: 'checker-warp',
  label: 'Checker Warp',
  glsl: `void main() {
  vec2 uv = (v_uv - 0.5) * u_scale + 0.5;
  float warp = sin(uv.y * 6.0 + u_time) * 0.08 + sin(uv.x * 5.0 - u_time * 0.7) * 0.08;
  vec2 p = uv + warp;
  float cells = 8.0;
  float cx = floor(p.x * cells);
  float cy = floor(p.y * cells);
  float checker = mod(cx + cy, 2.0);
  vec3 col = mix(u_colourA, u_colourB, checker);
  fragColor = vec4(col * u_intensity, 1.0);
}`,
  cpuSample(u, v, time, uniforms) {
    const ca = colour01(uniforms.colourA)
    const cb = colour01(uniforms.colourB)
    const scale = uniforms.scale
    const x = (u - 0.5) * scale + 0.5
    const y = (v - 0.5) * scale + 0.5
    const warp =
      Math.sin(y * 6 + time) * 0.08 + Math.sin(x * 5 - time * 0.7) * 0.08
    const px = x + warp
    const py = y + warp
    const cells = 8
    const cx = Math.floor(px * cells)
    const cy = Math.floor(py * cells)
    const checker = ((cx + cy) % 2 + 2) % 2
    return applyIntensity(mixRgb(ca, cb, checker), uniforms.intensity)
  }
}
