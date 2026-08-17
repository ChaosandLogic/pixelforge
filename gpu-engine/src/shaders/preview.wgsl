struct PreviewUniforms {
  src_width: u32,
  src_height: u32,
  dst_size: u32,
  _pad: u32,
}

@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var out_tex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> u: PreviewUniforms;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.dst_size || gid.y >= u.dst_size) { return; }
  let uv = vec2<f32>((f32(gid.x) + 0.5) / f32(u.dst_size), (f32(gid.y) + 0.5) / f32(u.dst_size));
  let rgb = textureSampleLevel(src, samp, uv, 0.0).xyz;
  textureStore(out_tex, vec2<i32>(i32(gid.x), i32(gid.y)), vec4<f32>(rgb, 1.0));
}
