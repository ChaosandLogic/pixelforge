/** Shared uniforms for curated 2D shader presets (CPU + GLSL). */
export interface ShaderUniforms {
  scale: number
  colourA: { r: number; g: number; b: number }
  colourB: { r: number; g: number; b: number }
  intensity: number
}

export type CpuRgb = { r: number; g: number; b: number }

/**
 * Curated preset: GLSL fragment body (injected into the WebGL wrapper) plus a
 * matching CPU sampler for headless / bake when the GPU sidecar is unavailable.
 *
 * GLSL body must define `void main()` and may use:
 * `v_uv`, `u_resolution`, `u_time`, `u_scale`, `u_colourA`, `u_colourB`, `u_intensity`, `fragColor`.
 * GPU evaluation uses the matching WGSL modes in gpu-engine (plasma/tunnel/ripples/spiral/checker-warp/aurora).
 */
export interface ShaderPreset {
  id: string
  label: string
  glsl: string
  cpuSample: (u: number, v: number, time: number, uniforms: ShaderUniforms) => CpuRgb
}
