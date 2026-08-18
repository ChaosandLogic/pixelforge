struct Uniforms {
  mode: u32,
  width: u32,
  height: u32,
  flags: u32,
  time: f32,
  delta: f32,
  amount: f32,
  gain: f32,
  p0: vec4<f32>,
  p1: vec4<f32>,
  p2: vec4<f32>,
  p3: vec4<f32>,
  colour_a: vec4<f32>,
  colour_b: vec4<f32>,
  colour_c: vec4<f32>,
  stop_count: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
  stops: array<vec4<f32>, 16>,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var tex_a: texture_2d<f32>;
@group(0) @binding(2) var tex_b: texture_2d<f32>;
@group(0) @binding(3) var tex_c: texture_2d<f32>;
@group(0) @binding(4) var samp: sampler;
@group(0) @binding(5) var out_tex: texture_storage_2d<rgba32float, write>;

fn clamp01(v: f32) -> f32 {
  return clamp(v, 0.0, 1.0);
}

fn srgb_to_linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}

fn linear_to_srgb(c: f32) -> f32 {
  if (c <= 0.0031308) { return c * 12.92; }
  return 1.055 * pow(max(c, 0.0), 1.0 / 2.4) - 0.055;
}

fn srgb_to_oklab(rgb: vec3<f32>) -> vec3<f32> {
  let lr = srgb_to_linear(rgb.x);
  let lg = srgb_to_linear(rgb.y);
  let lb = srgb_to_linear(rgb.z);
  let l = pow(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb, 1.0 / 3.0);
  let m = pow(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb, 1.0 / 3.0);
  let s = pow(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb, 1.0 / 3.0);
  return vec3<f32>(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  );
}

fn oklab_to_srgb(lab: vec3<f32>) -> vec3<f32> {
  let l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  let m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  let s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  let l = l_ * l_ * l_;
  let m = m_ * m_ * m_;
  let s = s_ * s_ * s_;
  let lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return vec3<f32>(
    clamp01(linear_to_srgb(lr)),
    clamp01(linear_to_srgb(lg)),
    clamp01(linear_to_srgb(lb))
  );
}

fn mix_oklab(a: vec3<f32>, b: vec3<f32>, t: f32) -> vec3<f32> {
  let tt = clamp01(t);
  return oklab_to_srgb(mix(srgb_to_oklab(a), srgb_to_oklab(b), tt));
}

fn sample_stops(t: f32) -> vec3<f32> {
  let n = u.stop_count;
  if (n == 0u) { return vec3<f32>(0.0); }
  let first = u.stops[0];
  if (n == 1u || t <= first.w) { return first.xyz; }
  let last = u.stops[n - 1u];
  if (t >= last.w) { return last.xyz; }
  for (var i = 0u; i < n - 1u; i++) {
    let a = u.stops[i];
    let b = u.stops[i + 1u];
    if (t >= a.w && t <= b.w) {
      let span = b.w - a.w;
      let f = select(0.0, (t - a.w) / span, span > 0.0);
      return mix_oklab(a.xyz, b.xyz, f);
    }
  }
  return last.xyz;
}

fn fract_pos(v: f32) -> f32 {
  return v - floor(v);
}

fn ping_pong(v: f32) -> f32 {
  let x = fract_pos(v * 0.5) * 2.0;
  return select(2.0 - x, x, x <= 1.0);
}

fn apply_edge(v: f32, mode: u32) -> f32 {
  if (mode == 1u) { return fract_pos(v); }
  if (mode == 2u) { return ping_pong(v); }
  return clamp01(v);
}

fn hash1(n: f32) -> f32 {
  return fract_pos(sin(n * 127.1 + 311.7) * 43758.5453123);
}

fn value_noise_2d(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = p - i;
  let ux = f.x * f.x * (3.0 - 2.0 * f.x);
  let uy = f.y * f.y * (3.0 - 2.0 * f.y);
  let a = hash1(i.x + i.y * 57.0);
  let b = hash1(i.x + 1.0 + i.y * 57.0);
  let c = hash1(i.x + (i.y + 1.0) * 57.0);
  let d = hash1(i.x + 1.0 + (i.y + 1.0) * 57.0);
  return mix(mix(a, b, ux), mix(c, d, ux), uy);
}

fn value_noise_3d(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = p - i;
  let u = f * f * (3.0 - 2.0 * f);
  let h = i.x + i.y * 57.0 + i.z * 113.0;
  let c000 = hash1(h);
  let c100 = hash1(h + 1.0);
  let c010 = hash1(h + 57.0);
  let c110 = hash1(h + 58.0);
  let c001 = hash1(h + 113.0);
  let c101 = hash1(h + 114.0);
  let c011 = hash1(h + 170.0);
  let c111 = hash1(h + 171.0);
  let x00 = mix(c000, c100, u.x);
  let x10 = mix(c010, c110, u.x);
  let x01 = mix(c001, c101, u.x);
  let x11 = mix(c011, c111, u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
}

fn fade(t: f32) -> f32 {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

fn grad3(hash: f32, x: f32, y: f32, z: f32) -> f32 {
  let h = u32(hash * 16.0) & 15u;
  let u = select(y, x, h < 8u);
  let v = select(select(x, z, h == 12u || h == 14u), y, h < 4u);
  let su = select(-u, u, (h & 1u) == 0u);
  let sv = select(-v, v, (h & 2u) == 0u);
  return su + sv;
}

fn perlin3(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = p - i;
  let u = fade(f.x);
  let v = fade(f.y);
  let w = fade(f.z);
  let n = i.x + i.y * 57.0 + i.z * 113.0;
  let aaa = hash1(n);
  let baa = hash1(n + 1.0);
  let aba = hash1(n + 57.0);
  let bba = hash1(n + 58.0);
  let aab = hash1(n + 113.0);
  let bab = hash1(n + 114.0);
  let abb = hash1(n + 170.0);
  let bbb = hash1(n + 171.0);
  let x1 = mix(grad3(aaa, f.x, f.y, f.z), grad3(baa, f.x - 1.0, f.y, f.z), u);
  let x2 = mix(grad3(aba, f.x, f.y - 1.0, f.z), grad3(bba, f.x - 1.0, f.y - 1.0, f.z), u);
  let y1 = mix(x1, x2, v);
  let x3 = mix(grad3(aab, f.x, f.y, f.z - 1.0), grad3(bab, f.x - 1.0, f.y, f.z - 1.0), u);
  let x4 = mix(grad3(abb, f.x, f.y - 1.0, f.z - 1.0), grad3(bbb, f.x - 1.0, f.y - 1.0, f.z - 1.0), u);
  return mix(y1, mix(x3, x4, v), w) * 0.5 + 0.5;
}

fn hash14(p: vec4<f32>) -> f32 {
  return hash1(p.x + p.y * 57.0 + p.z * 113.0 + p.w * 311.0);
}

fn grad4(h: f32, x: f32, y: f32, z: f32, w: f32) -> f32 {
  let hi = u32(h * 32.0) & 31u;
  let a = select(-1.0, 1.0, (hi & 1u) == 0u);
  let b = select(-1.0, 1.0, (hi & 2u) == 0u);
  let c = select(-1.0, 1.0, (hi & 4u) == 0u);
  let which = (hi >> 3u) & 3u;
  if (which == 0u) { return b * y + c * z + a * w; }
  if (which == 1u) { return a * x + c * z + b * w; }
  if (which == 2u) { return a * x + b * y + c * w; }
  return a * x + b * y + c * z;
}

fn corner4(i: vec4<f32>, f: vec4<f32>, d: vec4<f32>) -> f32 {
  return grad4(hash14(i + d), f.x - d.x, f.y - d.y, f.z - d.z, f.w - d.w);
}

fn perlin4(p: vec4<f32>) -> f32 {
  let i = floor(p);
  let f = p - i;
  let u = fade(f.x);
  let v = fade(f.y);
  let s = fade(f.z);
  let t = fade(f.w);
  let n0000 = corner4(i, f, vec4<f32>(0.0, 0.0, 0.0, 0.0));
  let n1000 = corner4(i, f, vec4<f32>(1.0, 0.0, 0.0, 0.0));
  let n0100 = corner4(i, f, vec4<f32>(0.0, 1.0, 0.0, 0.0));
  let n1100 = corner4(i, f, vec4<f32>(1.0, 1.0, 0.0, 0.0));
  let n0010 = corner4(i, f, vec4<f32>(0.0, 0.0, 1.0, 0.0));
  let n1010 = corner4(i, f, vec4<f32>(1.0, 0.0, 1.0, 0.0));
  let n0110 = corner4(i, f, vec4<f32>(0.0, 1.0, 1.0, 0.0));
  let n1110 = corner4(i, f, vec4<f32>(1.0, 1.0, 1.0, 0.0));
  let n0001 = corner4(i, f, vec4<f32>(0.0, 0.0, 0.0, 1.0));
  let n1001 = corner4(i, f, vec4<f32>(1.0, 0.0, 0.0, 1.0));
  let n0101 = corner4(i, f, vec4<f32>(0.0, 1.0, 0.0, 1.0));
  let n1101 = corner4(i, f, vec4<f32>(1.0, 1.0, 0.0, 1.0));
  let n0011 = corner4(i, f, vec4<f32>(0.0, 0.0, 1.0, 1.0));
  let n1011 = corner4(i, f, vec4<f32>(1.0, 0.0, 1.0, 1.0));
  let n0111 = corner4(i, f, vec4<f32>(0.0, 1.0, 1.0, 1.0));
  let n1111 = corner4(i, f, vec4<f32>(1.0, 1.0, 1.0, 1.0));
  let x00 = mix(mix(n0000, n1000, u), mix(n0100, n1100, u), v);
  let x10 = mix(mix(n0010, n1010, u), mix(n0110, n1110, u), v);
  let x01 = mix(mix(n0001, n1001, u), mix(n0101, n1101, u), v);
  let x11 = mix(mix(n0011, n1011, u), mix(n0111, n1111, u), v);
  return mix(mix(x00, x10, s), mix(x01, x11, s), t) * 0.5 + 0.5;
}

fn sample_tex(tex: texture_2d<f32>, uv: vec2<f32>) -> vec3<f32> {
  let dims = vec2<f32>(textureDimensions(tex));
  let clamped = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));
  return textureSampleLevel(tex, samp, clamped, 0.0).xyz;
}

fn sample_tex_edge(tex: texture_2d<f32>, uv: vec2<f32>, wrap: u32) -> vec3<f32> {
  var su = uv.x;
  var sv = uv.y;
  if (wrap == 1u) {
    su = fract_pos(su);
    sv = fract_pos(sv);
  } else {
    su = clamp01(su);
    sv = clamp01(sv);
  }
  return textureSampleLevel(tex, samp, vec2<f32>(su, sv), 0.0).xyz;
}

fn axis_pos(uv: vec2<f32>, z: f32, axis: u32) -> f32 {
  switch axis {
    case 1u: { return uv.y; }
    case 2u: { return z; }
    case 3u: { return (uv.x + uv.y) * 0.5; }
    case 4u: { return uv.x; }
    default: { return uv.x; }
  }
}

fn map_gradient_pos(pos: f32) -> f32 {
  var t = (pos + u.p0.x) * u.p0.y + u.p0.z;
  if ((u.flags & (1u << 9u)) != 0u) {
    t = ping_pong(t);
  } else {
    t = fract_pos(t);
  }
  return clamp01(t);
}

fn hsv_shift(rgb: vec3<f32>, hue: f32, sat_scale: f32, val_scale: f32) -> vec3<f32> {
  let mx = max(rgb.x, max(rgb.y, rgb.z));
  let mn = min(rgb.x, min(rgb.y, rgb.z));
  let d = mx - mn;
  var h = 0.0;
  if (d > 0.0) {
    if (mx == rgb.x) { h = (rgb.y - rgb.z) / d; h = h - floor(h / 6.0) * 6.0; }
    else if (mx == rgb.y) { h = (rgb.z - rgb.x) / d + 2.0; }
    else { h = (rgb.x - rgb.y) / d + 4.0; }
    h = h / 6.0;
    if (h < 0.0) { h += 1.0; }
  }
  var s = select(0.0, d / mx, mx > 0.0);
  var v = mx;
  h = fract_pos(h + hue);
  s = clamp01(s * sat_scale);
  v = clamp01(v * val_scale);
  let i = floor(h * 6.0);
  let f = h * 6.0 - i;
  let p = v * (1.0 - s);
  let q = v * (1.0 - f * s);
  let t = v * (1.0 - (1.0 - f) * s);
  let ii = u32(i) % 6u;
  switch ii {
    case 0u: { return vec3<f32>(v, t, p); }
    case 1u: { return vec3<f32>(q, v, p); }
    case 2u: { return vec3<f32>(p, v, t); }
    case 3u: { return vec3<f32>(p, q, v); }
    case 4u: { return vec3<f32>(t, p, v); }
    default: { return vec3<f32>(v, p, q); }
  }
}

fn map_curve_ch(v: f32, shadows: f32, mid: f32, hi: f32) -> f32 {
  var x = v;
  if (x < 0.33) { x += shadows * (0.33 - x); }
  else if (x < 0.66) { x += mid * (0.5 - abs(x - 0.5)); }
  else { x += hi * (x - 0.66); }
  return clamp01(x);
}

fn heat_color(t: f32) -> vec3<f32> {
  let x = clamp01(t);
  if (x < 0.25) {
    let k = x / 0.25;
    return vec3<f32>(k * 0.4, 0.0, 0.0);
  }
  if (x < 0.5) {
    let k = (x - 0.25) / 0.25;
    return vec3<f32>(0.4 + k * 0.6, k * 0.15, 0.0);
  }
  if (x < 0.75) {
    let k = (x - 0.5) / 0.25;
    return vec3<f32>(1.0, 0.15 + k * 0.55, k * 0.05);
  }
  let k = (x - 0.75) / 0.25;
  return vec3<f32>(1.0, 0.7 + k * 0.3, 0.05 + k * 0.95);
}

fn fit_uv(uv: vec2<f32>, src_aspect: f32, dst_aspect: f32, fit: u32) -> vec2<f32> {
  var su = uv.x;
  var sv = uv.y;
  if (fit == 1u) {
    if (src_aspect > dst_aspect) {
      let scale = dst_aspect / src_aspect;
      sv = (sv - 0.5) / scale + 0.5;
    } else {
      let scale = src_aspect / dst_aspect;
      su = (su - 0.5) / scale + 0.5;
    }
  } else if (fit == 2u) {
    if (src_aspect > dst_aspect) {
      let scale = src_aspect / dst_aspect;
      sv = (sv - 0.5) * scale + 0.5;
    } else {
      let scale = dst_aspect / src_aspect;
      su = (su - 0.5) * scale + 0.5;
    }
  }
  return vec2<f32>(su, sv);
}

fn eval_pixel(gid: vec2<u32>) -> vec3<f32> {
  let w = f32(u.width);
  let h = f32(u.height);
  let uv = vec2<f32>((f32(gid.x) + 0.5) / w, (f32(gid.y) + 0.5) / h);
  let z = 0.5;
  let axis = u.flags & 15u;
  let wrap = (u.flags >> 4u) & 3u;
  let sub = (u.flags >> 6u) & 7u;
  let src_a = sample_tex(tex_a, uv);
  let src_b = sample_tex(tex_b, uv);
  let src_c = sample_tex(tex_c, uv);

  switch u.mode {
    case 0u: { return u.colour_a.xyz; }
    case 1u: {
      var pos: f32;
      if (axis == 5u) {
        let d = uv - u.p1.xy;
        pos = length(vec3<f32>(d.x, d.y, z - u.p1.z));
      } else {
        pos = axis_pos(uv, z, axis);
      }
      return sample_stops(map_gradient_pos(pos));
    }
    case 2u: {
      let pos = axis_pos(uv, z, axis);
      let t = 0.5 + 0.5 * sin(6.28318530718 * (u.p0.x * pos - u.p0.y * u.time));
      return mix_oklab(u.colour_a.xyz, u.colour_b.xyz, t);
    }
    case 3u: {
      let scale = u.p0.x;
      let speed = u.p0.y;
      let w_off = u.p0.z;
      let contrast = u.p0.w;
      let s = scale * 0.15;
      let cell = vec2<f32>(uv.x * w, uv.y * h);
      var n: f32;
      switch sub {
        case 1u: { n = value_noise_3d(vec3<f32>(cell.x * s, cell.y * s, z * s + u.time * speed)); }
        case 2u: { n = perlin3(vec3<f32>(uv.x * scale, uv.y * scale, z * scale + u.time * speed)); }
        case 3u: { n = perlin4(vec4<f32>(uv.x * scale, uv.y * scale, z * scale, w_off + u.time * speed)); }
        case 4u: { n = perlin4(vec4<f32>(uv.x * scale + u.time * speed, uv.y * scale, z * scale, w_off)); }
        default: { n = value_noise_2d(vec2<f32>(cell.x * s, cell.y * s + u.time * speed)); }
      }
      n = (n - 0.5) * contrast + 0.5;
      return mix_oklab(u.colour_a.xyz, u.colour_b.xyz, n);
    }
    case 4u: { return mix_oklab(src_a, src_b, u.amount); }
    case 5u: { return min(vec3<f32>(1.0), src_a + src_b * u.amount); }
    case 6u: { return src_a + (src_a * src_b - src_a) * u.amount; }
    case 7u: {
      let screened = 1.0 - (1.0 - src_a) * (1.0 - src_b);
      return src_a + (screened - src_a) * u.amount;
    }
    case 8u: { return mix_oklab(src_a, src_b, u.amount); }
    case 9u: {
      var acc = src_a;
      var cnt = 1.0;
      acc += src_b; cnt += 1.0;
      acc += src_c; cnt += 1.0;
      if (sub == 1u) { return max(src_a, max(src_b, src_c)); }
      if (sub == 2u) { return acc / cnt; }
      return min(vec3<f32>(1.0), src_a + src_b + src_c);
    }
    case 10u: {
      let faded = src_b * u.p0.x;
      if (sub == 1u) { return mix_oklab(src_a, faded, u.amount); }
      if (sub == 2u) {
        let screened = 1.0 - (1.0 - src_a) * (1.0 - faded);
        return src_a + (screened - src_a) * u.amount;
      }
      if (sub == 3u) { return src_a + (src_a * faded - src_a) * u.amount; }
      return min(vec3<f32>(1.0), src_a + faded * u.amount);
    }
    case 11u: {
      let radius = i32(u.p0.x);
      let denom = f32(radius * 2 + 1);
      var acc = vec3<f32>(0.0);
      let dims = vec2<i32>(i32(u.width), i32(u.height));
      for (var k = -radius; k <= radius; k++) {
        var x = i32(gid.x) + k;
        if (wrap == 1u) {
          x = ((x % dims.x) + dims.x) % dims.x;
        } else {
          x = clamp(x, 0, dims.x - 1);
        }
        let suv = vec2<f32>((f32(x) + 0.5) / w, uv.y);
        acc += sample_tex(tex_a, suv);
      }
      return acc / denom;
    }
    case 12u: {
      let radius = i32(u.p0.x);
      let denom = f32(radius * 2 + 1);
      var acc = vec3<f32>(0.0);
      let dims = vec2<i32>(i32(u.width), i32(u.height));
      for (var k = -radius; k <= radius; k++) {
        var y = i32(gid.y) + k;
        if (wrap == 1u) {
          y = ((y % dims.y) + dims.y) % dims.y;
        } else {
          y = clamp(y, 0, dims.y - 1);
        }
        let suv = vec2<f32>(uv.x, (f32(y) + 0.5) / h);
        acc += sample_tex(tex_a, suv);
      }
      return acc / denom;
    }
    case 13u: { return hsv_shift(src_a, u.p0.x, u.p0.y, u.p0.z); }
    case 14u: {
      var c = src_a * u.p0.x;
      c = (c - vec3<f32>(0.5)) * u.p0.y + vec3<f32>(0.5);
      c = clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));
      return pow(c, vec3<f32>(u.p0.z));
    }
    case 15u: {
      return vec3<f32>(
        map_curve_ch(src_a.x, u.p0.x, u.p0.y, u.p0.z),
        map_curve_ch(src_a.y, u.p0.x, u.p0.y, u.p0.z),
        map_curve_ch(src_a.z, u.p0.x, u.p0.y, u.p0.z)
      );
    }
    case 16u: {
      let lum = 0.2126 * src_a.x + 0.7152 * src_a.y + 0.0722 * src_a.z;
      return mix_oklab(u.colour_a.xyz, u.colour_b.xyz, lum);
    }
    case 17u: {
      var c = (src_a + vec3<f32>(u.p0.x)) * u.p0.z;
      c.x *= u.p1.x;
      c.z *= u.p1.y;
      c = clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));
      return pow(c, vec3<f32>(u.p0.y));
    }
    case 18u: { return mix_oklab(u.colour_a.xyz, u.colour_b.xyz, u.amount); }
    case 19u: { return select(src_a, src_b, u.amount >= u.p0.x); }
    case 20u: { return src_a * u.amount; }
    case 21u: {
      let theta = u.p0.x * 6.28318530718;
      let c = cos(theta);
      let s = sin(theta);
      let cu = u.p0.y;
      let cv = u.p0.z;
      let du = uv.x - cu;
      let dv = uv.y - cv;
      let ru = c * du + s * dv + cu;
      let rv = -s * du + c * dv + cv;
      return sample_tex_edge(tex_a, vec2<f32>(ru, rv), 0u);
    }
    case 22u: {
      let segs = max(u.p0.x, 2.0);
      let cu = u.p0.y;
      let cv = u.p0.z;
      let du = uv.x - cu;
      let dv = uv.y - cv;
      var angle = atan2(dv, du);
      if (angle < 0.0) { angle += 6.28318530718; }
      let radius = length(vec2<f32>(du, dv));
      let seg_angle = 6.28318530718 / segs;
      var seg = angle / seg_angle;
      let seg_index = floor(seg);
      var local = seg - seg_index;
      if (sub == 0u && (u32(seg_index) % 2u) == 1u) { local = 1.0 - local; }
      let out_a = local * seg_angle;
      let ru = cos(out_a) * radius + cu;
      let rv = sin(out_a) * radius + cv;
      return sample_tex_edge(tex_a, vec2<f32>(ru, rv), 1u);
    }
    case 23u: {
      let mapc = src_b;
      var du = 0.0;
      var dv = 0.0;
      let lum = 0.2126 * mapc.x + 0.7152 * mapc.y + 0.0722 * mapc.z;
      if (sub == 1u) { dv = (lum - 0.5) * 2.0 * u.amount / h; }
      else if (sub == 2u) {
        du = (mapc.x - 0.5) * 2.0 * u.amount / w;
        dv = (mapc.y - 0.5) * 2.0 * u.amount / h;
      } else {
        du = (lum - 0.5) * 2.0 * u.amount / w;
      }
      return sample_tex_edge(tex_a, uv + vec2<f32>(du, dv), wrap);
    }
    case 24u: {
      let centre = u.p0.y;
      let scale = max(u.p0.z, 0.001);
      var pos = uv.x;
      if ((u.flags & (1u << 10u)) != 0u) { pos = 1.0 - pos; }
      var v = (pos - centre) / scale + centre - u.p0.x;
      v = apply_edge(v, wrap);
      return sample_tex_edge(tex_a, vec2<f32>(v, uv.y), 0u);
    }
    case 25u: {
      var x = uv.x;
      if (sub == 1u) { x = 1.0 - x; }
      else { if (x > 0.5) { x = 1.0 - x; } }
      return sample_tex(tex_a, vec2<f32>(x, uv.y));
    }
    case 26u: {
      let shift = u.p0.x;
      return sample_tex_edge(tex_a, vec2<f32>(uv.x - shift, uv.y), 1u);
    }
    case 27u: {
      let centre = u.p0.y;
      let scale = max(u.p0.x, 0.001);
      let v = apply_edge((uv.x - centre) / scale + centre, wrap);
      return sample_tex_edge(tex_a, vec2<f32>(v, uv.y), 0u);
    }
    case 28u: {
      let start = u.p0.x;
      let endp = u.p0.y;
      let soft = u.p0.z;
      let off = u.p0.w;
      let t = uv.x - off;
      var m = smoothstep(start - soft, start, t) * (1.0 - smoothstep(endp, endp + soft, t));
      if ((u.flags & (1u << 11u)) != 0u) { m = 1.0 - m; }
      return src_a * m;
    }
    case 29u: {
      let dims = vec2<f32>(textureDimensions(tex_a));
      let src_aspect = dims.x / max(dims.y, 1.0);
      let dst_aspect = w / max(h, 1.0);
      let mapped = fit_uv(uv, src_aspect, dst_aspect, sub);
      if ((u.flags & (1u << 12u)) != 0u) {
        if (mapped.x < 0.0 || mapped.x > 1.0 || mapped.y < 0.0 || mapped.y > 1.0) {
          return vec3<f32>(0.0);
        }
      }
      return sample_tex_edge(tex_a, mapped, 0u) * u.gain;
    }
    case 30u: {
      let scale = u.p0.x;
      let speed = u.p0.y;
      let turb = u.p0.z;
      let rise = u.p0.w;
      let nx = uv.x * scale;
      let ny = uv.y * scale - u.time * speed;
      let nz = u.time * 0.35;
      var heat = value_noise_3d(vec3<f32>(nx, ny, nz));
      heat += turb * 0.5 * value_noise_3d(vec3<f32>(nx * 2.3 + 17.0, ny * 1.7, nz * 1.1));
      heat += (1.0 - uv.y) * rise;
      heat -= uv.y * 0.35;
      return heat_color(heat);
    }
    case 31u: {
      let scaled = (uv - vec2<f32>(0.5)) * u.p0.x + vec2<f32>(0.5);
      let t = u.time;
      var v = sin(scaled.x * 10.0 + t);
      v += sin(scaled.y * 10.0 + t * 1.3);
      v += sin((scaled.x + scaled.y) * 8.0 + t * 0.7);
      v += sin(length(scaled - vec2<f32>(0.5)) * 16.0 - t * 2.0);
      v = v * 0.25 + 0.5;
      return mix(u.colour_a.xyz, u.colour_b.xyz, clamp01(v)) * u.gain;
    }
    case 32u: {
      let p = (uv - vec2<f32>(0.5)) * u.p0.x;
      let r = length(p) + 1e-4;
      let a = atan2(p.y, p.x);
      let zed = 1.0 / r + u.time * 0.8;
      let rings = sin(zed * 6.0 + a * 3.0) * 0.5 + 0.5;
      let spokes = sin(a * 8.0 - u.time) * 0.5 + 0.5;
      var v = mix(rings, spokes, 0.35);
      v *= smoothstep(0.0, 0.15, r);
      return mix(u.colour_a.xyz, u.colour_b.xyz, v) * u.gain;
    }
    case 33u: {
      let p = (uv - vec2<f32>(0.5)) * u.p0.x;
      let d = length(p);
      let wave = sin(d * 28.0 - u.time * 6.0);
      let envelope = exp(-d * 3.5);
      var v = wave * 0.5 + 0.5;
      v = mix(0.15, v, envelope);
      return mix(u.colour_a.xyz, u.colour_b.xyz, clamp01(v)) * u.gain;
    }
    case 34u: {
      let p = (uv - vec2<f32>(0.5)) * u.p0.x;
      let r = length(p);
      let a = atan2(p.y, p.x);
      let arms = sin(a * 5.0 - r * 18.0 + u.time * 3.0) * 0.5 + 0.5;
      let glow = exp(-r * 2.2);
      return mix(u.colour_a.xyz, u.colour_b.xyz, clamp01(arms * glow)) * u.gain;
    }
    case 35u: {
      let scaled = (uv - vec2<f32>(0.5)) * u.p0.x + vec2<f32>(0.5);
      let warp = sin(scaled.y * 6.0 + u.time) * 0.08 + sin(scaled.x * 5.0 - u.time * 0.7) * 0.08;
      let p = scaled + vec2<f32>(warp);
      let cx = floor(p.x * 8.0);
      let cy = floor(p.y * 8.0);
      let checker = abs((cx + cy) % 2.0);
      return mix(u.colour_a.xyz, u.colour_b.xyz, checker) * u.gain;
    }
    case 36u: {
      let scaled = (uv - vec2<f32>(0.5)) * u.p0.x + vec2<f32>(0.5);
      let band = sin(scaled.x * 4.0 + u.time * 0.6) * 0.15 + sin(scaled.x * 9.0 - u.time * 0.4) * 0.08;
      let y = scaled.y + band;
      let curtain = smoothstep(0.15, 0.45, y) * (1.0 - smoothstep(0.55, 0.9, y));
      let shimmer = sin(scaled.x * 20.0 + u.time * 2.0 + y * 10.0) * 0.5 + 0.5;
      let v = curtain * mix(0.4, 1.0, shimmer);
      return mix(u.colour_a.xyz, u.colour_b.xyz, clamp01(v)) * u.gain;
    }
    case 37u: { return src_a; }
    default: { return vec3<f32>(0.0); }
  }
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let rgb = eval_pixel(gid.xy);
  textureStore(out_tex, vec2<i32>(i32(gid.x), i32(gid.y)), vec4<f32>(rgb, 1.0));
}
