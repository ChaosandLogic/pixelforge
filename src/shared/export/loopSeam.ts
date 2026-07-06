import { CHANNELS_PER_PIXEL } from '../messages'

export interface LoopSeamResult {
  /** 0–100; percentage of channels within MATCH_TOLERANCE at the loop seam. */
  matchPercent: number
  /** Mean absolute RGB channel difference across the seam (0–255). */
  meanDelta: number
  /** Worst single-channel difference across the seam (0–255). */
  maxDelta: number
}

const SEAM_WARN_MATCH_PERCENT = 95
/** 8-bit quantisation slack: a ±1 code difference is visually identical, so it
 * should not drag the match percentage down for an otherwise perfect loop. */
const MATCH_TOLERANCE = 1

export function seamWarningThreshold(): number {
  return SEAM_WARN_MATCH_PERCENT
}

/**
 * Estimate loop-closure quality by comparing the first baked frame with the
 * frame that plays immediately after the last one when looping.
 *
 * The correct comparison is frame 0 (t=0) against the *wrap frame* at t=period
 * — for a clean loop those are identical. When a `seamFrame` (rendered one step
 * past the last baked frame) is provided we use it; otherwise we fall back to
 * comparing frame 0 with the last baked frame, which is one motion step short of
 * the true seam and therefore pessimistic for anything that moves.
 */
export function measureLoopSeam(
  frames: Uint8Array,
  frameCount: number,
  pixelCount: number,
  seamFrame: Uint8Array | null = null,
  channelsPerPixel: number = CHANNELS_PER_PIXEL
): LoopSeamResult {
  const frameBytes = pixelCount * channelsPerPixel
  if (frameBytes <= 0) {
    return { matchPercent: 100, meanDelta: 0, maxDelta: 0 }
  }

  let cmp: Uint8Array
  let cmpOffset: number
  if (seamFrame !== null && seamFrame.length >= frameBytes) {
    cmp = seamFrame
    cmpOffset = 0
  } else {
    if (frameCount < 2) return { matchPercent: 100, meanDelta: 0, maxDelta: 0 }
    cmp = frames
    cmpOffset = (frameCount - 1) * frameBytes
  }

  let totalDelta = 0
  let matchingChannels = 0
  let maxDelta = 0

  for (let i = 0; i < frameBytes; i++) {
    const delta = Math.abs((frames[i] ?? 0) - (cmp[cmpOffset + i] ?? 0))
    totalDelta += delta
    if (delta <= MATCH_TOLERANCE) matchingChannels++
    if (delta > maxDelta) maxDelta = delta
  }

  return {
    matchPercent: (matchingChannels / frameBytes) * 100,
    meanDelta: totalDelta / frameBytes,
    maxDelta
  }
}

export function formatLoopSeam(result: LoopSeamResult): string {
  return (
    `Loop match: ${result.matchPercent.toFixed(1)}% ` +
    `(avg Δ ${result.meanDelta.toFixed(1)}, max Δ ${result.maxDelta})`
  )
}
