/**
 * Message contracts between the renderer (UI) and the engine host
 * (utilityProcess). Carried over a MessagePort; payloads are structured-clone
 * safe. The renderer never evaluates anything — it only sends config/intent
 * and receives frames + status.
 */
import type { OutputProtocolKind } from '@shared/output/config'
import type { GraphData } from './graph/types'
import type { FixtureRange } from './patch/layout'

export const CHANNELS_PER_PIXEL = 3
export const DEFAULT_TARGET_FPS = 44
/** SharedArrayBuffer capacity. 8192 px = ~48 sACN universes; DDP has no such limit. */
export const MAX_PIXELS = 8192

export interface EngineConfig {
  /** First sACN universe; the channel stream chunks into consecutive universes from here */
  startUniverse: number
  /** Local interface IP to bind the output socket to; null = OS default */
  iface: string | null
  targetFps: number
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  startUniverse: 1,
  iface: null,
  targetFps: DEFAULT_TARGET_FPS
}

export type RendererToEngine =
  | { type: 'output-start' }
  | { type: 'output-stop' }
  | {
      type: 'load-project'
      graph: GraphData
      config: EngineConfig
      positions: Float32Array
      count: number
      resolutionWidth: number
      resolutionHeight: number
      fixtureRanges: FixtureRange[]
    }
  | { type: 'set-graph'; graph: GraphData }
  | { type: 'set-config'; config: Partial<EngineConfig> }
  | {
      type: 'set-patch'
      positions: Float32Array
      count: number
      resolutionWidth: number
      resolutionHeight: number
      fixtureRanges: FixtureRange[]
    }
  | { type: 'media-frame'; nodeId: string; width: number; height: number; data: Uint8Array }
  | { type: 'audio-levels'; nodeId: string; low: number; mid: number; high: number; beat?: number }
  | { type: 'midi-state'; nodeId: string; value: number; velocity: number; gate: number }
  | { type: 'keyboard-state'; nodeId: string; gate: number }
  | { type: 'trigger'; nodeId: string; port: string }
  | { type: 'bake'; requestId: number; durationMs: number; fps: number }

/** Result of an offline bake: `frameCount` frames of RGB bytes, concatenated. */
export interface BakeResult {
  requestId: number
  frames: Uint8Array
  frameCount: number
  pixelCount: number
  fps: number
  error: string | null
}

/** Hard cap on baked animation size (raw RGB bytes) to bound memory use. */
export const MAX_BAKE_BYTES = 16 * 1024 * 1024

export interface EngineStatus {
  /** Evaluator frames per second (exponential moving average) */
  fps: number
  /** Output packets sent in the last second */
  packetsPerSec: number
  /** Whether the output sender is transmitting */
  outputActive: boolean
  startUniverse: number
  universeCount: number
  pixelCount: number
  /** Active output protocol from the Pixel Output node */
  outputProtocol: OutputProtocolKind
  outputProtocolName: string
  /** Last output error, if any (cleared on successful send) */
  outputError: string | null
  /** Graph validation error (cycle, unknown node type), null when valid */
  graphError: string | null
  /** Active Pixel Output routes */
  outputCount: number
  /** Per-route output errors keyed by output node id */
  outputErrors: Record<string, string | null>
}

/** Live thumbnail of one node's primary output. */
export type NodePreview =
  | {
      kind: 'pixels'
      data: Uint8Array
      width: number
      height: number
      /** Physical layout thumbnail mapped from patch positions. */
      layout?: { data: Uint8Array; width: number; height: number }
    }
  | { kind: 'float'; value: number }
export type NodePreviews = Record<string, NodePreview>

/** Per-node evaluate() duration in milliseconds for the last frame. */
export type NodeTimings = Record<string, number>

export type EngineToRenderer =
  | {
      type: 'frame'
      pixels: Uint8Array
      pixelCount: number
      previews: NodePreviews
      timings: NodeTimings
    }
  | { type: 'status'; status: EngineStatus }
  | ({ type: 'bake-result' } & BakeResult)

export interface NetworkInterfaceInfo {
  name: string
  address: string
  internal: boolean
}
