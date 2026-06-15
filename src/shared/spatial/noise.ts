/** 1D hash -> 0..1 */
function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return s - Math.floor(s)
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Smooth 3D value noise. */
export function valueNoise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = smoothstep(x - ix)
  const fy = smoothstep(y - iy)
  const fz = smoothstep(z - iz)

  const h = (i: number, j: number, k: number): number => hash1(i + j * 57.0 + k * 113.0)

  const c000 = h(ix, iy, iz)
  const c100 = h(ix + 1, iy, iz)
  const c010 = h(ix, iy + 1, iz)
  const c110 = h(ix + 1, iy + 1, iz)
  const c001 = h(ix, iy, iz + 1)
  const c101 = h(ix + 1, iy, iz + 1)
  const c011 = h(ix, iy + 1, iz + 1)
  const c111 = h(ix + 1, iy + 1, iz + 1)

  const x00 = c000 + (c100 - c000) * fx
  const x10 = c010 + (c110 - c010) * fx
  const x01 = c001 + (c101 - c001) * fx
  const x11 = c011 + (c111 - c011) * fx
  const y0 = x00 + (x10 - x00) * fy
  const y1 = x01 + (x11 - x01) * fy
  return y0 + (y1 - y0) * fz
}

const PERM = (() => {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(hash1(i + 17.3) * (i + 1))
    const tmp = p[i] as number
    p[i] = p[j] as number
    p[j] = tmp
  }
  const out = new Uint8Array(512)
  for (let i = 0; i < 512; i++) out[i] = p[i & 255] as number
  return out
})()

const GRAD3: readonly [number, number, number][] = [
  [1, 1, 0],
  [-1, 1, 0],
  [1, -1, 0],
  [-1, -1, 0],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, 1, 1],
  [0, -1, 1],
  [0, 1, -1],
  [0, -1, -1]
]

const GRAD4: readonly [number, number, number, number][] = [
  [1, 1, 0, 0],
  [-1, 1, 0, 0],
  [1, -1, 0, 0],
  [-1, -1, 0, 0],
  [1, 0, 1, 0],
  [-1, 0, 1, 0],
  [1, 0, -1, 0],
  [-1, 0, -1, 0],
  [0, 1, 1, 0],
  [0, -1, 1, 0],
  [0, 1, -1, 0],
  [0, -1, -1, 0],
  [1, 0, 0, 1],
  [-1, 0, 0, 1],
  [1, 0, 0, -1],
  [-1, 0, 0, -1],
  [0, 1, 0, 1],
  [0, -1, 0, 1],
  [0, 1, 0, -1],
  [0, -1, 0, -1],
  [0, 0, 1, 1],
  [0, 0, -1, 1],
  [0, 0, 1, -1],
  [0, 0, -1, -1]
]

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function grad3(hash: number, x: number, y: number, z: number): number {
  const g = GRAD3[hash % 12] as [number, number, number]
  return g[0] * x + g[1] * y + g[2] * z
}

function grad4(hash: number, x: number, y: number, z: number, w: number): number {
  const g = GRAD4[hash % 24] as [number, number, number, number]
  return g[0] * x + g[1] * y + g[2] * z + g[3] * w
}

/** Classic 3D Perlin noise, output 0..1. */
export function perlin3D(x: number, y: number, z: number): number {
  const xi = Math.floor(x) & 255
  const yi = Math.floor(y) & 255
  const zi = Math.floor(z) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const zf = z - Math.floor(z)
  const u = fade(xf)
  const v = fade(yf)
  const w = fade(zf)

  const aaa = PERM[PERM[PERM[xi]! + yi]! + zi]!
  const aba = PERM[PERM[PERM[xi]! + yi + 1]! + zi]!
  const aab = PERM[PERM[PERM[xi]! + yi]! + zi + 1]!
  const abb = PERM[PERM[PERM[xi]! + yi + 1]! + zi + 1]!
  const baa = PERM[PERM[PERM[xi + 1]! + yi]! + zi]!
  const bba = PERM[PERM[PERM[xi + 1]! + yi + 1]! + zi]!
  const bab = PERM[PERM[PERM[xi + 1]! + yi]! + zi + 1]!
  const bbb = PERM[PERM[PERM[xi + 1]! + yi + 1]! + zi + 1]!

  const x1 = lerp(
    u,
    grad3(aaa, xf, yf, zf),
    grad3(baa, xf - 1, yf, zf)
  )
  const x2 = lerp(
    u,
    grad3(aba, xf, yf - 1, zf),
    grad3(bba, xf - 1, yf - 1, zf)
  )
  const y1 = lerp(v, x1, x2)
  const x3 = lerp(
    u,
    grad3(aab, xf, yf, zf - 1),
    grad3(bab, xf - 1, yf, zf - 1)
  )
  const x4 = lerp(
    u,
    grad3(abb, xf, yf - 1, zf - 1),
    grad3(bbb, xf - 1, yf - 1, zf - 1)
  )
  const y2 = lerp(v, x3, x4)
  return (lerp(w, y1, y2) + 1) * 0.5
}

/** 4D Perlin noise (spatial xyz + fourth dimension w), output 0..1. */
export function perlin4D(x: number, y: number, z: number, w: number): number {
  const xi = Math.floor(x) & 255
  const yi = Math.floor(y) & 255
  const zi = Math.floor(z) & 255
  const wi = Math.floor(w) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const zf = z - Math.floor(z)
  const wf = w - Math.floor(w)
  const u = fade(xf)
  const v = fade(yf)
  const s = fade(zf)
  const t = fade(wf)

  const hash = (a: number, b: number, c: number, d: number): number =>
    PERM[PERM[PERM[PERM[a]! + b]! + c]! + d]!

  const corner = (dx: number, dy: number, dz: number, dw: number): number => {
    const h = hash(xi + dx, yi + dy, zi + dz, wi + dw)
    return grad4(h, xf - dx, yf - dy, zf - dz, wf - dw)
  }

  const lerp4 = (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number
  ): number => {
    const x1 = lerp(u, a, b)
    const x2 = lerp(u, c, d)
    const y1 = lerp(v, x1, x2)
    const x3 = lerp(u, e, f)
    const x4 = lerp(u, g, h)
    const y2 = lerp(v, x3, x4)
    return lerp(s, y1, y2)
  }

  const n0 = lerp4(
    corner(0, 0, 0, 0),
    corner(1, 0, 0, 0),
    corner(0, 1, 0, 0),
    corner(1, 1, 0, 0),
    corner(0, 0, 1, 0),
    corner(1, 0, 1, 0),
    corner(0, 1, 1, 0),
    corner(1, 1, 1, 0)
  )
  const n1 = lerp4(
    corner(0, 0, 0, 1),
    corner(1, 0, 0, 1),
    corner(0, 1, 0, 1),
    corner(1, 1, 0, 1),
    corner(0, 0, 1, 1),
    corner(1, 0, 1, 1),
    corner(0, 1, 1, 1),
    corner(1, 1, 1, 1)
  )
  return (lerp(t, n0, n1) + 1) * 0.5
}

function lerp(t: number, a: number, b: number): number {
  return a + t * (b - a)
}
