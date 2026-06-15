/**
 * Core node graph types, shared between the renderer (editing, validation)
 * and the engine host (evaluation).
 */
import type { Resolution } from '../spatial/resolution'
import type { ScheduleSlot } from '../schedule/types'
import type { SequenceSegment } from '../sequence/types'
import type { GradientStop } from '../colour/gradientStops'
import type { ComponentGraphData } from '../component/types'
import type { FixtureRange } from '../patch/layout'

export type PortType = 'float' | 'colour' | 'pixels' | 'resolution' | 'trigger'

/** 0-255 integer channels, as produced by UI colour pickers. */
export interface ColourValue {
  r: number
  g: number
  b: number
}

export type ParamValue =
  | number
  | boolean
  | string
  | ColourValue
  | SequenceSegment[]
  | GradientStop[]
  | ScheduleSlot[]
  | ComponentGraphData
export type ParamValues = Record<string, ParamValue>

/**
 * Values flowing through ports. 'pixels' ports carry pooled Float32Array
 * buffers (sRGB triplets 0..1) owned by the evaluator — nodes must never
 * hold onto them across frames.
 */
export type PortValue = number | Float32Array | ColourValue | Resolution | null
export type PortValues = Record<string, PortValue>

export interface PortDef {
  name: string
  label: string
  type: PortType
}

export type ParamDef =
  | { name: string; label: string; type: 'float'; default: number; min: number; max: number; step?: number }
  | { name: string; label: string; type: 'int'; default: number; min: number; max: number }
  | { name: string; label: string; type: 'boolean'; default: boolean }
  | { name: string; label: string; type: 'colour'; default: ColourValue }
  | { name: string; label: string; type: 'select'; default: string; options: string[] }
  | { name: string; label: string; type: 'string'; default: string }
  | { name: string; label: string; type: 'file'; default: string }
  | { name: string; label: string; type: 'segments'; default: SequenceSegment[] }
  | { name: string; label: string; type: 'gradient-stops'; default: GradientStop[] }
  | { name: string; label: string; type: 'schedule'; default: ScheduleSlot[] }
  | { name: string; label: string; type: 'component'; default: ComponentGraphData }

export type NodeCategory =
  | 'generator'
  | 'transform'
  | 'composite'
  | 'colour'
  | 'time'
  | 'sequence'
  | 'audio'
  | 'spatial'
  | 'logic'
  | 'math'
  | 'setup'
  | 'output'

/** A media frame pushed from the renderer (video decode happens UI-side). */
export interface MediaFrame {
  width: number
  height: number
  data: Uint8Array
}

/** Band levels pushed from the renderer (audio analysis happens UI-side). */
export interface AudioLevels {
  low: number
  mid: number
  high: number
  /** Decaying beat/onset pulse 0..1 from spectral flux. */
  beat: number
}

export interface MidiState {
  value: number
  velocity: number
  gate: number
}

export interface OscState {
  value: number
}

/** Per-frame evaluation context handed to every node. */
export interface EvalContext {
  timeMs: number
  deltaMs: number
  pixelCount: number
  /** Logical grid size for 2D pattern authoring (e.g. 16×8 matrix). */
  resolution: Resolution
  /** Normalised pixel positions, xyz triplets. */
  positions: Float32Array
  /** Layout fixture index ranges (patch order). */
  fixtureRanges: FixtureRange[]
  /** ID of the node currently being evaluated. */
  nodeId: string
  /** Acquire a pooled pixel buffer (pixelCount * 3 floats). Valid for this frame only. */
  acquire(): Float32Array
  /** Latest decoded media frame for a node (VideoFile), or null if none yet. */
  getMediaFrame(nodeId: string): MediaFrame | null
  /** Latest band levels for a node (AudioIn), or null if none yet. */
  getAudioLevels(nodeId: string): AudioLevels | null
  getMidiState(nodeId: string): MidiState | null
  getOscState(nodeId: string): OscState | null
  /** Exponential low-pass smoothing for float signals. */
  smoothFloat(value: number, smoothMs: number): number
  /** Random float in range; re-roll when forceReroll is true or at rate. */
  randomFloat(min: number, max: number, rateHz: number, forceReroll: boolean): number
  /** Per-sequence beat offset (manual advance / reset). */
  getSequenceBeatOffset(nodeId: string): number
  setSequenceBeatOffset(nodeId: string, offset: number): void
  /** Consume a one-shot trigger on an input port; returns true once per fire. */
  consumeTrigger(nodeId: string, port: string): boolean
  /** Pull-evaluate a single wired input (used by Sequence for active segments only). */
  evalInput(port: string): PortValue | null
  /** Delay a float signal by delayMs (per-node ring buffer). */
  delayFloat(value: number, delayMs: number): number
  /** Hold a float value for holdMs after trigger on port; otherwise tracks input. */
  holdFloat(value: number, holdMs: number, triggerPort: string): number
  /** Ramp 0→1 over durationMs; restart on trigger when loop is false. */
  rampFloat(durationMs: number, loop: boolean, triggerPort: string): number
  /** Fire a one-shot trigger when a float input crosses threshold (rising edge). */
  risingEdge(port: string, value: number, threshold?: number): void
  /** Pulse downstream trigger inputs wired to this output port. */
  emitTrigger(outputPort: string): void
  /** Fire trigger output when value crosses threshold (rising edge). */
  pulseTrigger(outputPort: string, value: number, threshold?: number): void
  /** External inputs when evaluating inside a Component subgraph. */
  componentInputs: PortValues | null
  /** Evaluate an embedded component graph; returns primary output value. */
  evalSubgraph(graph: ComponentGraphData, externalInputs: PortValues): PortValue | null
  /** Returns true the first time a schedule slot fires for a given minute key. */
  markScheduleFired(nodeId: string, slotIndex: number, fireKey: string): boolean
  /**
   * Blend input with this node's stored previous frame, persist the result,
   * and return it. Used by the Feedback node for temporal compositing.
   */
  feedbackPixels(
    input: Float32Array,
    amount: number,
    decay: number,
    mode: string,
    reset: boolean
  ): Float32Array
}

export interface NodeTypeDef {
  /** Unique registry key, e.g. 'generator/gradient' */
  type: string
  label: string
  category: NodeCategory
  description: string
  inputs: PortDef[]
  outputs: PortDef[]
  params: ParamDef[]
  evaluate(inputs: PortValues, params: ParamValues, ctx: EvalContext): PortValues
}

/** Reference a float output to drive a node parameter (TouchDesigner-style). */
export interface ParamBinding {
  fromNode: string
  fromPort: string
}

export interface NodeData {
  id: string
  /** Registry key */
  type: string
  position: { x: number; y: number }
  params: ParamValues
  /** Float/int params driven by another node's float output. */
  paramBindings?: Record<string, ParamBinding>
  label?: string
  /** Show a live output preview on the node; omit or true = on, false = hidden */
  preview?: boolean
  /** Pixel preview raster: patch stream grid or physical LED layout. */
  previewView?: 'patch' | 'output'
}

export interface EdgeData {
  id: string
  fromNode: string
  fromPort: string
  toNode: string
  toPort: string
}

export interface GraphData {
  nodes: NodeData[]
  edges: EdgeData[]
}

// --- typed param accessors (keeps node impls free of `any`) --------------

export function floatParam(params: ParamValues, name: string, fallback = 0): number {
  const v = params[name]
  return typeof v === 'number' ? v : fallback
}

export function intParam(params: ParamValues, name: string, fallback = 0): number {
  const v = params[name]
  return typeof v === 'number' ? Math.floor(v) : fallback
}

export function stringParam(params: ParamValues, name: string, fallback = ''): string {
  const v = params[name]
  return typeof v === 'string' ? v : fallback
}

export function colourParam(params: ParamValues, name: string): ColourValue {
  const v = params[name]
  if (typeof v === 'object' && v !== null && 'r' in v) return v
  return { r: 255, g: 255, b: 255 }
}

export function pixelsInput(inputs: PortValues, name: string): Float32Array | null {
  const v = inputs[name]
  return v instanceof Float32Array ? v : null
}

/** Float input port value, falling back to the same-named param when unconnected. */
export function floatInput(inputs: PortValues, params: ParamValues, name: string, fallback = 0): number {
  const v = inputs[name]
  if (typeof v === 'number') return v
  return floatParam(params, name, fallback)
}

/** Resolution from an optional input port, else patch/layout default on the context. */
export function resolutionInput(inputs: PortValues, ctx: EvalContext): Resolution {
  const v = inputs['resolution']
  if (typeof v === 'object' && v !== null && 'width' in v && 'height' in v) {
    const r = v as Resolution
    const res: Resolution = {
      width: Math.max(1, Math.floor(r.width)),
      height: Math.max(1, Math.floor(r.height))
    }
    if (Array.isArray(r.indices) && r.indices.length > 0) res.indices = r.indices
    return res
  }
  return ctx.resolution
}

export function defaultParams(def: NodeTypeDef): ParamValues {
  const params: ParamValues = {}
  for (const p of def.params) {
    if (p.type === 'colour') params[p.name] = { ...p.default }
    else if (p.type === 'segments') params[p.name] = [...p.default]
    else if (p.type === 'gradient-stops') params[p.name] = structuredClone(p.default)
    else if (p.type === 'schedule') params[p.name] = structuredClone(p.default)
    else if (p.type === 'component') params[p.name] = structuredClone(p.default)
    else params[p.name] = p.default
  }
  return params
}
