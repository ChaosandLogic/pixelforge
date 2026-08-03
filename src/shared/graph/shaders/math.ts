/** Shared helpers for CPU shader samplers (0..1 RGB). */

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function mixRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number
): { r: number; g: number; b: number } {
  return { r: mix(a.r, b.r, t), g: mix(a.g, b.g, t), b: mix(a.b, b.b, t) }
}

/** ColourValue 0..255 → 0..1. */
export function colour01(c: { r: number; g: number; b: number }): { r: number; g: number; b: number } {
  return { r: c.r / 255, g: c.g / 255, b: c.b / 255 }
}

export function applyIntensity(
  rgb: { r: number; g: number; b: number },
  intensity: number
): { r: number; g: number; b: number } {
  const k = Math.max(0, intensity)
  return {
    r: clamp01(rgb.r * k),
    g: clamp01(rgb.g * k),
    b: clamp01(rgb.b * k)
  }
}
