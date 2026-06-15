/**
 * Hand-rolled sRGB <-> Oklab conversions (Björn Ottosson's reference
 * coefficients). Used for all colour blending in the evaluation path —
 * culori is UI-only. All channel values are 0..1.
 */

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

export function srgbToOklab(r: number, g: number, b: number, out: Float32Array | number[], offset = 0): void {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)

  out[offset] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  out[offset + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  out[offset + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
}

export function oklabToSrgb(L: number, a: number, b: number, out: Float32Array | number[], offset = 0): void {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  out[offset] = clamp01(linearToSrgb(lr))
  out[offset + 1] = clamp01(linearToSrgb(lg))
  out[offset + 2] = clamp01(linearToSrgb(lb))
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * Precomputed two-colour Oklab ramp. Build once per frame from the
 * endpoint colours, then sample per pixel — endpoints are converted once,
 * only the lerp + Oklab->sRGB runs per pixel.
 */
export class OklabRamp {
  private readonly a = new Float32Array(3)
  private readonly b = new Float32Array(3)

  /** Endpoint channels are sRGB 0..1. */
  set(r0: number, g0: number, b0: number, r1: number, g1: number, b1: number): void {
    srgbToOklab(r0, g0, b0, this.a)
    srgbToOklab(r1, g1, b1, this.b)
  }

  /** Write the blended sRGB colour at t (0..1) into out[offset..offset+2]. */
  sample(t: number, out: Float32Array, offset: number): void {
    const u = t < 0 ? 0 : t > 1 ? 1 : t
    const L = this.a[0]! + (this.b[0]! - this.a[0]!) * u
    const A = this.a[1]! + (this.b[1]! - this.a[1]!) * u
    const B = this.a[2]! + (this.b[2]! - this.a[2]!) * u
    oklabToSrgb(L, A, B, out, offset)
  }
}

interface OklabStop {
  t: number
  lab: Float32Array
}

/**
 * Multi-stop Oklab gradient. Stops are sorted once per frame; sampling
 * lerps between neighbouring stops in Oklab space.
 */
export class OklabGradientRamp {
  private readonly stops: OklabStop[] = []
  private readonly tmp = new Float32Array(3)

  /** Stop channels are sRGB 0..1. */
  setStops(stops: ReadonlyArray<{ position: number; r: number; g: number; b: number }>): void {
    this.stops.length = 0
    if (stops.length === 0) return

    const sorted = [...stops].sort((a, b) => a.position - b.position)
    for (const stop of sorted) {
      const lab = new Float32Array(3)
      srgbToOklab(stop.r, stop.g, stop.b, lab)
      this.stops.push({ t: stop.position, lab })
    }
  }

  sample(t: number, out: Float32Array, offset: number): void {
    if (this.stops.length === 0) {
      out[offset] = 0
      out[offset + 1] = 0
      out[offset + 2] = 0
      return
    }

    const u = t < 0 ? 0 : t > 1 ? 1 : t
    const first = this.stops[0]!
    if (u <= first.t || this.stops.length === 1) {
      oklabToSrgb(first.lab[0]!, first.lab[1]!, first.lab[2]!, out, offset)
      return
    }

    const last = this.stops[this.stops.length - 1]!
    if (u >= last.t) {
      oklabToSrgb(last.lab[0]!, last.lab[1]!, last.lab[2]!, out, offset)
      return
    }

    for (let i = 0; i < this.stops.length - 1; i++) {
      const a = this.stops[i]!
      const b = this.stops[i + 1]!
      if (u < a.t || u > b.t) continue
      const span = b.t - a.t
      const f = span > 0 ? (u - a.t) / span : 0
      this.tmp[0] = a.lab[0]! + (b.lab[0]! - a.lab[0]!) * f
      this.tmp[1] = a.lab[1]! + (b.lab[1]! - a.lab[1]!) * f
      this.tmp[2] = a.lab[2]! + (b.lab[2]! - a.lab[2]!) * f
      oklabToSrgb(this.tmp[0]!, this.tmp[1]!, this.tmp[2]!, out, offset)
      return
    }

    oklabToSrgb(last.lab[0]!, last.lab[1]!, last.lab[2]!, out, offset)
  }
}
