import { CHANNELS_PER_PIXEL, MAX_BAKE_BYTES, MAX_BAKE_FPS } from '@shared/messages'
import { OUTPUT_NODE_TYPE } from '@shared/graph/nodes'
import type { AudioLevels, GraphData, MediaFrame } from '@shared/graph/types'
import { BufferPool } from './evaluator/BufferPool'
import { Evaluator } from './evaluator/Evaluator'

import type { FixtureRange } from '@shared/patch/layout'

export interface BakeInput {
  graph: GraphData
  /** Raw (unnormalised) patch positions, xyz triplets in pixel order. */
  positions: Float32Array
  pixelCount: number
  resolutionWidth: number
  resolutionHeight: number
  fixtureRanges: FixtureRange[]
  /** Last media frame per node id, so image/video nodes don't bake black. */
  mediaFrames: ReadonlyMap<string, MediaFrame>
  /** Last audio levels per node id (a static snapshot for the whole bake). */
  audioLevels: ReadonlyMap<string, AudioLevels>
  durationMs: number
  fps: number
}

export interface BakeOutput {
  frames: Uint8Array
  frameCount: number
  pixelCount: number
  fps: number
  /**
   * One extra frame rendered at the loop boundary (t = frameCount/fps): the
   * content that plays immediately after the last frame when looping. Compared
   * against frame 0 to measure the true seam. Never included in the export.
   */
  seamFrame: Uint8Array | null
  error: string | null
}

/**
 * Offline render: evaluate the graph frame-by-frame from t=0 with a fixed
 * timestep and collect the quantised RGB bytes of every frame. Uses a fresh
 * Evaluator so the live engine's stateful nodes (delays, ramps, sequence
 * offsets) are untouched.
 */
export function bakeFrames(input: BakeInput): BakeOutput {
  const fps = Math.min(MAX_BAKE_FPS, Math.max(1, input.fps))
  const fail = (error: string): BakeOutput => ({
    frames: new Uint8Array(0),
    frameCount: 0,
    pixelCount: input.pixelCount,
    fps,
    seamFrame: null,
    error
  })

  const deltaMs = 1000 / fps
  const frameCount = Math.max(1, Math.round((input.durationMs / 1000) * fps))
  const bytesPerFrame = input.pixelCount * CHANNELS_PER_PIXEL
  const totalBytes = frameCount * bytesPerFrame
  if (totalBytes > MAX_BAKE_BYTES) {
    return fail(
      `Bake too large: ${frameCount} frames × ${input.pixelCount} pixels = ` +
        `${(totalBytes / 1024 / 1024).toFixed(1)} MB (max ${MAX_BAKE_BYTES / 1024 / 1024} MB). ` +
        'Reduce duration, fps, or pixel count.'
    )
  }

  const sab = new SharedArrayBuffer(bytesPerFrame)
  const pool = new BufferPool(input.pixelCount)
  const evaluator = new Evaluator(sab, input.pixelCount, pool)
  evaluator.setPatch(
    input.positions,
    input.pixelCount,
    input.resolutionWidth,
    input.resolutionHeight,
    input.fixtureRanges
  )
  evaluator.setGraph(input.graph)
  if (evaluator.graphError !== null) return fail(evaluator.graphError)

  const routes = input.graph.nodes.filter((n) => n.type === OUTPUT_NODE_TYPE)
  const firstOutputId = routes[0]?.id
  if (firstOutputId !== undefined) {
    const views = new Map<string, Uint8Array>([[firstOutputId, new Uint8Array(sab)]])
    evaluator.setOutputTargets([firstOutputId], views, new Uint8Array(sab))
  }

  for (const [nodeId, frame] of input.mediaFrames) {
    evaluator.setMediaFrame(nodeId, frame.width, frame.height, frame.data)
  }
  for (const [nodeId, levels] of input.audioLevels) {
    evaluator.setAudioLevels(nodeId, levels.low, levels.mid, levels.high, levels.beat ?? 0)
  }

  const view = new Uint8Array(sab)
  const frames = new Uint8Array(totalBytes)
  for (let f = 0; f < frameCount; f++) {
    evaluator.evaluate(f * deltaMs, deltaMs)
    frames.set(view, f * bytesPerFrame)
  }

  // Render one more step at the loop boundary so the seam can be measured
  // against the frame that would actually play on wrap (not the last frame,
  // which is one motion step short). Excluded from the exported animation.
  let seamFrame: Uint8Array | null = null
  if (frameCount >= 1 && bytesPerFrame > 0) {
    evaluator.evaluate(frameCount * deltaMs, deltaMs)
    seamFrame = new Uint8Array(bytesPerFrame)
    seamFrame.set(view)
  }

  return { frames, frameCount, pixelCount: input.pixelCount, fps, seamFrame, error: null }
}
