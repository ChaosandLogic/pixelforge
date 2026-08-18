/**
 * RGBW wire format. The evaluator stays RGB float; white is derived here
 * when a Pixel Output is set to RGBW.
 */

export type ColorMode = 'rgb' | 'rgbw'
/** How the white channel is derived from RGB at output time. */
export type WhiteMode = 'subtractive' | 'luminance'

export const COLOR_MODES: ColorMode[] = ['rgb', 'rgbw']
export const WHITE_MODES: WhiteMode[] = ['subtractive', 'luminance']

export const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  rgb: 'RGB',
  rgbw: 'RGBW'
}

export const WHITE_MODE_LABELS: Record<WhiteMode, string> = {
  subtractive: 'Subtractive (extract)',
  luminance: 'Luminance (add)'
}

export const RGB_CHANNELS_PER_PIXEL = 3
export const RGBW_CHANNELS_PER_PIXEL = 4
/** 170 RGB pixels use 510 of 512 DMX channels. */
export const RGB_CHANNELS_PER_UNIVERSE = 510
/** 128 RGBW pixels fill a universe exactly. */
export const RGBW_CHANNELS_PER_UNIVERSE = 512

export function isColorMode(value: unknown): value is ColorMode {
  return value === 'rgb' || value === 'rgbw'
}

export function isWhiteMode(value: unknown): value is WhiteMode {
  return value === 'subtractive' || value === 'luminance'
}

export function parseColorMode(value: unknown): ColorMode {
  return value === 'rgbw' ? 'rgbw' : 'rgb'
}

export function parseWhiteMode(value: unknown): WhiteMode {
  return value === 'luminance' ? 'luminance' : 'subtractive'
}

export function channelsPerPixel(mode: ColorMode): 3 | 4 {
  return mode === 'rgbw' ? RGBW_CHANNELS_PER_PIXEL : RGB_CHANNELS_PER_PIXEL
}

export function dmxChannelsPerUniverse(mode: ColorMode): number {
  return mode === 'rgbw' ? RGBW_CHANNELS_PER_UNIVERSE : RGB_CHANNELS_PER_UNIVERSE
}

export function pixelsPerUniverse(mode: ColorMode): number {
  return mode === 'rgbw' ? 128 : 170
}

function clamp8(value: number): number {
  if (value <= 0) return 0
  if (value >= 255) return 255
  return value | 0
}

/** Derive RGBW bytes from one RGB triplet (0–255). */
export function rgbToRgbw(
  r: number,
  g: number,
  b: number,
  whiteMode: WhiteMode
): [number, number, number, number] {
  const cr = clamp8(r)
  const cg = clamp8(g)
  const cb = clamp8(b)
  if (whiteMode === 'luminance') {
    return [cr, cg, cb, clamp8(Math.round(0.2126 * cr + 0.7152 * cg + 0.0722 * cb))]
  }
  const w = cr < cg ? (cr < cb ? cr : cb) : cg < cb ? cg : cb
  return [cr - w, cg - w, cb - w, w]
}

/**
 * Expand a packed RGB frame (pixelCount × 3) to RGBW (pixelCount × 4).
 * Reuses `out` when it is large enough to avoid per-tick allocation.
 */
export function expandRgbToRgbw(
  rgb: Uint8Array,
  pixelCount: number,
  whiteMode: WhiteMode,
  out?: Uint8Array
): Uint8Array {
  const needed = pixelCount * RGBW_CHANNELS_PER_PIXEL
  const dest = out !== undefined && out.length >= needed ? out : new Uint8Array(needed)
  for (let i = 0; i < pixelCount; i++) {
    const src = i * 3
    const dst = i * 4
    const [wr, wg, wb, ww] = rgbToRgbw(rgb[src] ?? 0, rgb[src + 1] ?? 0, rgb[src + 2] ?? 0, whiteMode)
    dest[dst] = wr
    dest[dst + 1] = wg
    dest[dst + 2] = wb
    dest[dst + 3] = ww
  }
  return dest.length === needed ? dest : dest.subarray(0, needed)
}

/** Expand concatenated RGB frames to RGBW for FSEQ / offline encode. */
export function expandRgbFramesToRgbw(
  frames: Uint8Array,
  frameCount: number,
  pixelCount: number,
  whiteMode: WhiteMode
): Uint8Array {
  const rgbFrameBytes = pixelCount * RGB_CHANNELS_PER_PIXEL
  const rgbwFrameBytes = pixelCount * RGBW_CHANNELS_PER_PIXEL
  const out = new Uint8Array(frameCount * rgbwFrameBytes)
  for (let f = 0; f < frameCount; f++) {
    const rgb = frames.subarray(f * rgbFrameBytes, (f + 1) * rgbFrameBytes)
    const expanded = expandRgbToRgbw(rgb, pixelCount, whiteMode)
    out.set(expanded, f * rgbwFrameBytes)
  }
  return out
}

/** Pack RGB (or already-RGBW) into the wire stream for one frame. */
export function packOutputStream(
  rgb: Uint8Array,
  pixelCount: number,
  colorMode: ColorMode,
  whiteMode: WhiteMode,
  out?: Uint8Array
): Uint8Array {
  if (colorMode !== 'rgbw') {
    const needed = pixelCount * RGB_CHANNELS_PER_PIXEL
    return rgb.length === needed ? rgb : rgb.subarray(0, needed)
  }
  return expandRgbToRgbw(rgb, pixelCount, whiteMode, out)
}
