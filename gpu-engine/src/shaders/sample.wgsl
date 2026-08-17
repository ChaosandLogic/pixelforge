struct SampleUniforms {
  width: u32,
  height: u32,
  pixel_count: u32,
  _pad: u32,
}

@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var<storage, read> positions: array<f32>;
@group(0) @binding(3) var<storage, read_write> leds: array<f32>;
@group(0) @binding(4) var<uniform> u: SampleUniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= u.pixel_count) { return; }
  let ux = positions[i * 3u];
  let vy = positions[i * 3u + 1u];
  let rgb = textureSampleLevel(src, samp, clamp(vec2<f32>(ux, vy), vec2<f32>(0.0), vec2<f32>(1.0)), 0.0).xyz;
  leds[i * 3u] = rgb.x;
  leds[i * 3u + 1u] = rgb.y;
  leds[i * 3u + 2u] = rgb.z;
}
