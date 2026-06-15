import { oklabToSrgb, srgbToOklab } from '../../colour/oklab'

const labA = new Float32Array(3)
const labB = new Float32Array(3)

export function blendAdd(a: Float32Array, b: Float32Array, amount: number, out: Float32Array): void {
  const n = out.length
  for (let i = 0; i < n; i++) {
    const v = (a[i] as number) + (b[i] as number) * amount
    out[i] = v > 1 ? 1 : v
  }
}

export function blendMultiply(a: Float32Array, b: Float32Array, amount: number, out: Float32Array): void {
  const n = out.length
  for (let i = 0; i < n; i++) {
    const av = a[i] as number
    out[i] = av + ((av * (b[i] as number)) - av) * amount
  }
}

export function blendScreen(a: Float32Array, b: Float32Array, amount: number, out: Float32Array): void {
  const n = out.length
  for (let i = 0; i < n; i++) {
    const av = a[i] as number
    const screened = 1 - (1 - av) * (1 - (b[i] as number))
    out[i] = av + (screened - av) * amount
  }
}

/** Oklab crossfade of two equal-length buffers. */
export function blendMix(a: Float32Array, b: Float32Array, amount: number, out: Float32Array): void {
  const t = amount < 0 ? 0 : amount > 1 ? 1 : amount
  const n = out.length
  for (let i = 0; i < n; i += 3) {
    srgbToOklab(a[i] as number, a[i + 1] as number, a[i + 2] as number, labA)
    srgbToOklab(b[i] as number, b[i + 1] as number, b[i + 2] as number, labB)
    const L = labA[0]! + (labB[0]! - labA[0]!) * t
    const A = labA[1]! + (labB[1]! - labA[1]!) * t
    const B = labA[2]! + (labB[2]! - labA[2]!) * t
    oklabToSrgb(L, A, B, out, i)
  }
}

/** Composite B over A in Oklab with opacity on B. */
export function blendOver(a: Float32Array, b: Float32Array, opacity: number, out: Float32Array): void {
  blendMix(a, b, opacity < 0 ? 0 : opacity > 1 ? 1 : opacity, out)
}
