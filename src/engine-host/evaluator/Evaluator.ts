import { performance } from 'node:perf_hooks'
import { CHANNELS_PER_PIXEL, MAX_PIXELS, type NodePreviews, type NodeTimings } from '@shared/messages'
import { getNodeType } from '@shared/graph/registry'
import { previewNodeIds } from '@shared/graph/preview'
import { applyParamBindings, graphHasCycle } from '@shared/graph/paramBinding'
import { evaluateSubgraph, evalSubgraphNode, type SubgraphContext } from '@shared/component/evaluateSubgraph'
import { OUTPUT_NODE_TYPE } from '@shared/graph/nodes'
import { FIXTURE_NODE_TYPE } from '@shared/graph/nodes/setup/Fixture'
import { SEQUENCE_NODE_TYPE } from '@shared/graph/nodes/sequence/Sequence'
import { SCHEDULE_NODE_TYPE } from '@shared/graph/nodes/schedule/Schedule'
import type { DelayBuffer, HoldState, RampState } from '@shared/graph/time/state'
import {
  pushDelaySample,
  sampleDelay,
  sampleHold,
  sampleRamp
} from '@shared/graph/time/state'
import type { AudioLevels, EvalContext, GraphData, KeyboardState, MediaFrame, MidiState, NodeData, OscState, PortValues } from '@shared/graph/types'
import { stringParam } from '@shared/graph/types'
import type { FixtureRange } from '@shared/patch/layout'
import { firstFixtureId, fixtureRangeById, indicesForFixture } from '@shared/patch/fixtureRoute'
import { blendAdd, blendMix, blendMultiply, blendScreen } from '@shared/graph/compositing/blend'
import {
  compactStreamPixels,
  previewResolutionForStream,
  rasterizeLayout,
  rasterizeStream
} from '@shared/preview/rasterize'
import { defaultResolution, type Resolution } from '@shared/spatial/resolution'
import type { BufferPool } from './BufferPool'

const VIDEO_NODE_TYPE = 'generator/video'

interface EdgeSource {
  fromNode: string
  fromPort: string
}

interface EdgeTarget {
  toNode: string
  toPort: string
}

/**
 * Pull-based graph evaluator. Evaluation starts at the output node and
 * walks upstream on demand; each node runs at most once per frame
 * (memoised).
 */
export class Evaluator {
  private view: Uint8Array
  private pixelCount: number
  private positions: Float32Array
  private readonly pool: BufferPool

  private nodesById = new Map<string, NodeData>()
  private edgesByTarget = new Map<string, EdgeSource>()
  private edgesBySource = new Map<string, EdgeTarget[]>()
  private scheduleNodeIds: string[] = []
  private outputNodeIds: string[] = []
  private outputViews = new Map<string, Uint8Array>()
  private fixtureRanges: FixtureRange[] = []
  private previewIds: string[] = []
  graphError: string | null = null
  /** Per-node output thumbnails captured during the last frame. */
  previews: NodePreviews = {}
  /** Per-node evaluate() durations (ms) for the last frame. */
  frameTimings: NodeTimings = {}

  private readonly memo = new Map<string, PortValues>()
  private readonly mediaFrames = new Map<string, MediaFrame>()
  private readonly audioLevels = new Map<string, AudioLevels>()
  private readonly midiStates = new Map<string, MidiState>()
  private readonly keyboardStates = new Map<string, KeyboardState>()
  private readonly oscStates = new Map<string, OscState>()
  private readonly smoothStates = new Map<string, number>()
  private readonly randomStates = new Map<string, { value: number; nextMs: number }>()
  private readonly sequenceBeatOffsets = new Map<string, number>()
  private readonly delayBuffers = new Map<string, DelayBuffer>()
  private readonly holdStates = new Map<string, HoldState>()
  private readonly rampStates = new Map<string, RampState>()
  private readonly pendingTriggers = new Set<string>()
  private readonly scheduleFired = new Map<string, Map<number, string>>()
  private readonly edgeStates = new Map<string, number>()
  private readonly feedbackBuffers = new Map<string, Float32Array>()
  private patchResolution: Resolution
  private readonly ctx: EvalContext

  constructor(sab: SharedArrayBuffer, pixelCount: number, pool: BufferPool) {
    this.view = new Uint8Array(sab)
    this.pixelCount = pixelCount
    this.pool = pool
    this.positions = buildLinePositions(pixelCount)
    this.patchResolution = defaultResolution(pixelCount)
    this.ctx = {
      timeMs: 0,
      deltaMs: 0,
      pixelCount,
      resolution: this.patchResolution,
      positions: this.positions,
      fixtureRanges: this.fixtureRanges,
      nodeId: '',
      acquire: () => this.pool.acquire(),
      getMediaFrame: (nodeId) => this.mediaFrames.get(nodeId) ?? null,
      getAudioLevels: (nodeId) => this.audioLevels.get(nodeId) ?? null,
      getMidiState: (nodeId) => this.midiStates.get(nodeId) ?? null,
      getKeyboardState: (nodeId) => this.keyboardStates.get(nodeId) ?? null,
      getOscState: (nodeId) => this.oscStates.get(nodeId) ?? null,
      smoothFloat: (value, smoothMs) => this.smoothFloat(this.ctx.nodeId, value, smoothMs),
      randomFloat: (min, max, rateHz, forceReroll) =>
        this.randomFloat(this.ctx.nodeId, min, max, rateHz, forceReroll),
      getSequenceBeatOffset: (nodeId) => this.sequenceBeatOffsets.get(nodeId) ?? 0,
      setSequenceBeatOffset: (nodeId, offset) => {
        this.sequenceBeatOffsets.set(nodeId, offset)
      },
      consumeTrigger: (nodeId, port) => {
        const key = `${nodeId}:${port}`
        if (!this.pendingTriggers.has(key)) return false
        this.pendingTriggers.delete(key)
        return true
      },
      evalInput: (port) => {
        const source = this.edgesByTarget.get(`${this.ctx.nodeId}:${port}`)
        if (source === undefined) return null
        return this.evalNode(source.fromNode)[source.fromPort] ?? null
      },
      delayFloat: (value, delayMs) => this.delayFloat(this.ctx.nodeId, value, delayMs),
      holdFloat: (value, holdMs, triggerPort) =>
        this.holdFloat(this.ctx.nodeId, value, holdMs, triggerPort),
      rampFloat: (durationMs, loop, triggerPort) =>
        this.rampFloat(this.ctx.nodeId, durationMs, loop, triggerPort),
      risingEdge: (port, value, threshold) =>
        this.risingEdge(this.ctx.nodeId, port, value, threshold ?? 0.5),
      emitTrigger: (outputPort) => this.emitTrigger(this.ctx.nodeId, outputPort),
      pulseTrigger: (outputPort, value, threshold) =>
        this.pulseTrigger(this.ctx.nodeId, outputPort, value, threshold ?? 0.5),
      componentInputs: null,
      evalSubgraph: (graph, externalInputs) => {
        const evalImpl = (
          nodeId: string,
          memo: Map<string, import('@shared/graph/types').PortValues>,
          subCtx: SubgraphContext
        ) => evalSubgraphNode(nodeId, memo, subCtx, this.ctx, evalImpl)
        return evaluateSubgraph(graph, externalInputs, this.ctx.nodeId, this.ctx, evalImpl)
      },
      markScheduleFired: (nodeId, slotIndex, fireKey) =>
        this.markScheduleFired(nodeId, slotIndex, fireKey),
      feedbackPixels: (input, amount, decay, mode, reset) =>
        this.feedbackPixels(this.ctx.nodeId, input, amount, decay, mode, reset)
    }
  }

  private emitTrigger(nodeId: string, outputPort: string): void {
    for (const edge of this.edgesBySource.get(`${nodeId}:${outputPort}`) ?? []) {
      this.pendingTriggers.add(`${edge.toNode}:${edge.toPort}`)
    }
  }

  private pulseTrigger(nodeId: string, outputPort: string, value: number, threshold: number): void {
    const key = `${nodeId}:pulse:${outputPort}`
    const prev = this.edgeStates.get(key) ?? 0
    this.edgeStates.set(key, value)
    if (prev < threshold && value >= threshold) this.emitTrigger(nodeId, outputPort)
  }

  private markScheduleFired(nodeId: string, slotIndex: number, fireKey: string): boolean {
    let map = this.scheduleFired.get(nodeId)
    if (map === undefined) {
      map = new Map()
      this.scheduleFired.set(nodeId, map)
    }
    if (map.get(slotIndex) === fireKey) return false
    map.set(slotIndex, fireKey)
    return true
  }

  private risingEdge(nodeId: string, port: string, value: number, threshold: number): void {
    const key = `${nodeId}:${port}`
    const prev = this.edgeStates.get(key) ?? 0
    this.edgeStates.set(key, value)
    if (prev < threshold && value >= threshold) {
      this.pendingTriggers.add(key)
    }
  }

  private smoothFloat(nodeId: string, value: number, smoothMs: number): number {
    const prev = this.smoothStates.get(nodeId) ?? value
    const tau = Math.max(1, smoothMs)
    const alpha = 1 - Math.exp(-this.ctx.deltaMs / tau)
    const next = prev + alpha * (value - prev)
    this.smoothStates.set(nodeId, next)
    return next
  }

  private randomFloat(nodeId: string, min: number, max: number, rateHz: number, forceReroll: boolean): number {
    let state = this.randomStates.get(nodeId)
    if (state === undefined) {
      state = { value: (min + max) * 0.5, nextMs: 0 }
      this.randomStates.set(nodeId, state)
    }
    const due = rateHz > 0 && this.ctx.timeMs >= state.nextMs
    if (forceReroll || due) {
      const t = Math.sin(this.ctx.timeMs * 0.001 + nodeId.length * 17.3) * 43758.5453
      const r = t - Math.floor(t)
      state.value = min + r * (max - min)
      if (rateHz > 0) state.nextMs = this.ctx.timeMs + 1000 / rateHz
    }
    return state.value
  }

  private delayFloat(nodeId: string, value: number, delayMs: number): number {
    let buf = this.delayBuffers.get(nodeId)
    if (buf === undefined) {
      buf = { times: [], values: [] }
      this.delayBuffers.set(nodeId, buf)
    }
    const maxSamples = Math.max(2, Math.ceil(delayMs / Math.max(1, this.ctx.deltaMs)) + 2)
    pushDelaySample(buf, this.ctx.timeMs, value, maxSamples)
    return sampleDelay(buf, this.ctx.timeMs, delayMs)
  }

  private holdFloat(nodeId: string, value: number, holdMs: number, triggerPort: string): number {
    let state = this.holdStates.get(nodeId)
    if (state === undefined) {
      state = { value, untilMs: 0 }
      this.holdStates.set(nodeId, state)
    }
    const key = `${nodeId}:${triggerPort}`
    const retrigger = this.pendingTriggers.has(key)
    if (retrigger) this.pendingTriggers.delete(key)
    return sampleHold(state, this.ctx.timeMs, value, holdMs, retrigger)
  }

  private rampFloat(nodeId: string, durationMs: number, loop: boolean, triggerPort: string): number {
    let state = this.rampStates.get(nodeId)
    if (state === undefined) {
      state = { startMs: this.ctx.timeMs }
      this.rampStates.set(nodeId, state)
    }
    const key = `${nodeId}:${triggerPort}`
    const restart = !loop && this.pendingTriggers.has(key)
    if (restart) this.pendingTriggers.delete(key)
    return sampleRamp(state, this.ctx.timeMs, durationMs, loop, restart)
  }

  private feedbackPixels(
    nodeId: string,
    input: Float32Array,
    amount: number,
    decay: number,
    mode: string,
    reset: boolean
  ): Float32Array {
    const len = input.length
    let prev = this.feedbackBuffers.get(nodeId)
    if (prev === undefined || prev.length !== len) {
      prev = new Float32Array(len)
      this.feedbackBuffers.set(nodeId, prev)
    } else if (reset) {
      prev.fill(0)
    }

    const faded = this.pool.acquire()
    for (let i = 0; i < len; i++) {
      faded[i] = (prev[i] as number) * decay
    }

    const out = this.pool.acquire()
    switch (mode) {
      case 'multiply':
        blendMultiply(input, faded, amount, out)
        break
      case 'screen':
        blendScreen(input, faded, amount, out)
        break
      case 'mix':
        blendMix(input, faded, amount, out)
        break
      default:
        blendAdd(input, faded, amount, out)
    }

    prev.set(out)
    return out
  }

  fireTrigger(nodeId: string, port: string): void {
    this.pendingTriggers.add(`${nodeId}:${port}`)
  }

  setMediaFrame(nodeId: string, width: number, height: number, data: Uint8Array): void {
    this.mediaFrames.set(nodeId, { width, height, data })
  }

  setAudioLevels(nodeId: string, low: number, mid: number, high: number, beat = 0): void {
    this.audioLevels.set(nodeId, { low, mid, high, beat })
  }

  setMidiState(nodeId: string, value: number, velocity: number, gate: number): void {
    this.midiStates.set(nodeId, { value, velocity, gate })
  }

  setKeyboardState(nodeId: string, gate: number): void {
    this.keyboardStates.set(nodeId, { gate })
  }

  setOscState(nodeId: string, value: number): void {
    this.oscStates.set(nodeId, { value })
  }

  /**
   * Install a patch: raw point positions in patch order. Each axis is
   * normalised to 0..1 independently so spatial effects always span the
   * full installation regardless of its physical dimensions.
   */
  setPatch(
    rawPositions: Float32Array,
    count: number,
    resolutionWidth: number,
    resolutionHeight: number,
    fixtureRanges: FixtureRange[] = []
  ): void {
    this.pixelCount = Math.max(1, Math.min(MAX_PIXELS, Math.floor(count)))
    this.positions = normalisePositions(rawPositions, this.pixelCount)
    this.patchResolution = {
      width: Math.max(1, Math.floor(resolutionWidth)),
      height: Math.max(1, Math.floor(resolutionHeight))
    }
    this.fixtureRanges = fixtureRanges
    this.pool.setPixelCount(this.pixelCount)
    this.ctx.pixelCount = this.pixelCount
    this.ctx.positions = this.positions
    this.ctx.resolution = this.patchResolution
    this.ctx.fixtureRanges = this.fixtureRanges
    this.feedbackBuffers.clear()
  }

  getPixelCount(): number {
    return this.pixelCount
  }

  /** Wire per-output SAB views from the output manager (preview aliases the first route). */
  setOutputTargets(nodeIds: string[], views: Map<string, Uint8Array>, previewView: Uint8Array): void {
    this.outputNodeIds = nodeIds
    this.outputViews = views
    this.view = previewView
  }

  setGraph(graph: GraphData): void {
    this.nodesById.clear()
    this.edgesByTarget.clear()
    this.edgesBySource.clear()
    this.scheduleNodeIds = []
    this.outputNodeIds = []
    this.graphError = null
    this.previewIds = previewNodeIds(graph.nodes)

    for (const node of graph.nodes) {
      if (getNodeType(node.type) === undefined) {
        this.graphError = `Unknown node type: ${node.type}`
        return
      }
      this.nodesById.set(node.id, node)
      if (node.type === OUTPUT_NODE_TYPE) {
        this.outputNodeIds.push(node.id)
      }
      if (node.type === SCHEDULE_NODE_TYPE) {
        this.scheduleNodeIds.push(node.id)
      }
    }
    for (const edge of graph.edges) {
      this.edgesByTarget.set(`${edge.toNode}:${edge.toPort}`, {
        fromNode: edge.fromNode,
        fromPort: edge.fromPort
      })
      const sourceKey = `${edge.fromNode}:${edge.fromPort}`
      const list = this.edgesBySource.get(sourceKey)
      const target: EdgeTarget = { toNode: edge.toNode, toPort: edge.toPort }
      if (list === undefined) this.edgesBySource.set(sourceKey, [target])
      else list.push(target)
    }

    if (graphHasCycle(graph)) {
      this.graphError = 'Graph contains a cycle'
      this.outputNodeIds = []
    }

    // Drop media frames for nodes that no longer exist.
    for (const id of this.mediaFrames.keys()) {
      if (!this.nodesById.has(id)) this.mediaFrames.delete(id)
    }
    for (const id of this.audioLevels.keys()) {
      if (!this.nodesById.has(id)) this.audioLevels.delete(id)
    }
    for (const id of this.delayBuffers.keys()) {
      if (!this.nodesById.has(id)) this.delayBuffers.delete(id)
    }
    for (const id of this.holdStates.keys()) {
      if (!this.nodesById.has(id)) this.holdStates.delete(id)
    }
    for (const id of this.rampStates.keys()) {
      if (!this.nodesById.has(id)) this.rampStates.delete(id)
    }
    for (const id of this.sequenceBeatOffsets.keys()) {
      if (!this.nodesById.has(id)) this.sequenceBeatOffsets.delete(id)
    }
    for (const key of this.edgeStates.keys()) {
      const nodeId = key.split(':')[0]
      if (nodeId !== undefined && !this.nodesById.has(nodeId)) this.edgeStates.delete(key)
    }
    for (const key of [...this.pendingTriggers]) {
      const nodeId = key.split(':')[0]
      if (nodeId !== undefined && !this.nodesById.has(nodeId)) this.pendingTriggers.delete(key)
    }
    for (const id of this.scheduleFired.keys()) {
      if (!this.nodesById.has(id)) this.scheduleFired.delete(id)
    }
    for (const id of this.feedbackBuffers.keys()) {
      if (!this.nodesById.has(id)) this.feedbackBuffers.delete(id)
    }
  }

  /** Evaluate one frame and write the result into the SharedArrayBuffer. */
  evaluate(timeMs: number, deltaMs: number): void {
    this.pool.releaseAll()
    this.memo.clear()
    this.frameTimings = {}
    this.ctx.timeMs = timeMs
    this.ctx.deltaMs = deltaMs

    if (this.graphError === null) {
      for (const id of this.scheduleNodeIds) {
        this.evalNode(id)
      }
    }

    const byteCount = this.pixelCount * CHANNELS_PER_PIXEL

    if (this.graphError === null && this.outputNodeIds.length > 0) {
      for (const outputId of this.outputNodeIds) {
        const view = this.outputViews.get(outputId) ?? this.view
        let pixels: Float32Array | null = null
        const source = this.edgesByTarget.get(`${outputId}:pixels`)
        if (source !== undefined) {
          const value = this.evalNode(source.fromNode)[source.fromPort]
          if (value instanceof Float32Array) pixels = value
        }
        this.writePixels(view, pixels, byteCount)
      }
    } else {
      this.view.fill(0, 0, byteCount)
    }

    this.capturePreviews()
  }

  /**
   * Evaluate preview-enabled nodes (memoised — anything already on the
   * output path costs nothing extra) and capture their primary output.
   */
  private capturePreviews(): void {
    const previews: NodePreviews = {}
    if (this.graphError === null) {
      for (const id of this.previewIds) {
        const node = this.nodesById.get(id)
        if (node === undefined) continue
        const def = getNodeType(node.type)
        const port = def?.outputs[0]
        if (def === undefined || port === undefined) continue

        const value = this.evalNode(id)[port.name]
        if (port.type === 'pixels' && value instanceof Float32Array) {
          const layout = rasterizeLayout(value, this.positions, this.pixelCount)
          let streamPreview: { data: Uint8Array; width: number; height: number }

          if (node.type === VIDEO_NODE_TYPE) {
            const frame = this.mediaFrames.get(id)
            if (frame !== null && frame !== undefined && frame.width > 0 && frame.height > 0) {
              streamPreview = {
                data: new Uint8Array(frame.data),
                width: frame.width,
                height: frame.height
              }
            } else {
              const { pixels: previewPixels, resolution: previewRes } = this.previewPixelsForNode(
                node,
                value
              )
              streamPreview = rasterizeStream(previewPixels, previewRes)
            }
          } else {
            const { pixels: previewPixels, resolution: previewRes } = this.previewPixelsForNode(
              node,
              value
            )
            streamPreview = rasterizeStream(previewPixels, previewRes)
          }

          previews[id] = {
            kind: 'pixels',
            ...streamPreview,
            layout: { data: layout.data, width: layout.width, height: layout.height }
          }
        } else if (port.type === 'float' && typeof value === 'number') {
          previews[id] = { kind: 'float', value }
        }
      }
    }
    this.previews = previews
  }

  /** Build stream + logical resolution for node preview (fills NODE_PREVIEW_SIZE², not patch layout). */
  private previewPixelsForNode(
    node: NodeData,
    pixels: Float32Array
  ): { pixels: Float32Array; resolution: Resolution } {
    if (node.type === FIXTURE_NODE_TYPE) {
      let fixtureId = stringParam(node.params, 'fixtureId', '')
      if (fixtureId === '') fixtureId = firstFixtureId(this.fixtureRanges)
      const range = fixtureRangeById(fixtureId, this.fixtureRanges)
      if (range !== undefined && range.count > 0) {
        const indices = indicesForFixture(fixtureId, this.fixtureRanges)
        return {
          pixels: compactStreamPixels(pixels, indices),
          resolution: { width: range.width, height: range.height }
        }
      }
    }

    const streamCount = Math.floor(pixels.length / 3)
    return {
      pixels,
      resolution: previewResolutionForStream(streamCount, this.ctx.resolution)
    }
  }

  /** Copy of the active pixel range, for posting to the renderer preview. */
  snapshot(): Uint8Array {
    return this.view.slice(0, this.pixelCount * CHANNELS_PER_PIXEL)
  }

  private writePixels(view: Uint8Array, pixels: Float32Array | null, byteCount: number): void {
    if (pixels === null) {
      view.fill(0, 0, byteCount)
      return
    }
    for (let i = 0; i < byteCount; i++) {
      const v = pixels[i] as number
      view[i] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255)
    }
  }

  private evalNode(nodeId: string): PortValues {
    const cached = this.memo.get(nodeId)
    if (cached !== undefined) return cached
    // Recursion guard: a cycle that slipped past validation terminates here.
    this.memo.set(nodeId, {})

    const node = this.nodesById.get(nodeId)
    if (node === undefined) return {}
    const def = getNodeType(node.type)
    if (def === undefined) return {}

    const inputs: PortValues = {}
    for (const port of def.inputs) {
      if (node.type === SEQUENCE_NODE_TYPE && port.name.startsWith('segment_')) continue
      const source = this.edgesByTarget.get(`${nodeId}:${port.name}`)
      inputs[port.name] = source !== undefined ? (this.evalNode(source.fromNode)[source.fromPort] ?? null) : null
    }

    // Set after input recursion — upstream evalNode calls mutate ctx.nodeId.
    this.ctx.nodeId = nodeId
    const resolveOutput = (fromNode: string, fromPort: string): unknown =>
      this.evalNode(fromNode)[fromPort] ?? null
    const params = applyParamBindings(node, inputs, node.params, resolveOutput)
    const t0 = performance.now()
    const outputs = def.evaluate(inputs, params, this.ctx)
    this.frameTimings[nodeId] = performance.now() - t0
    this.memo.set(nodeId, outputs)
    return outputs
  }
}

/** Default patch before the renderer sends one: a line along x. */
function buildLinePositions(pixelCount: number): Float32Array {
  const positions = new Float32Array(pixelCount * 3)
  const denom = Math.max(1, pixelCount - 1)
  for (let i = 0; i < pixelCount; i++) {
    positions[i * 3] = i / denom
    positions[i * 3 + 1] = 0.5
    positions[i * 3 + 2] = 0
  }
  return positions
}

/** Normalise each axis to 0..1 independently; degenerate axes collapse to 0.5. */
function normalisePositions(raw: Float32Array, count: number): Float32Array {
  const out = new Float32Array(count * 3)
  for (let axis = 0; axis < 3; axis++) {
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < count; i++) {
      const v = raw[i * 3 + axis] ?? 0
      if (v < min) min = v
      if (v > max) max = v
    }
    const range = max - min
    for (let i = 0; i < count; i++) {
      out[i * 3 + axis] = range > 0 ? ((raw[i * 3 + axis] ?? 0) - min) / range : 0.5
    }
  }
  return out
}
