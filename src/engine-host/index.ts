import type { MessagePortMain } from 'electron'
import {
  CHANNELS_PER_PIXEL,
  DEFAULT_ENGINE_CONFIG,
  MAX_PIXELS,
  type EngineConfig,
  type EngineToRenderer,
  type RendererToEngine
} from '@shared/messages'
import { registerStandardNodes } from '@shared/graph/nodes'
import type { AudioLevels, GraphData, MediaFrame } from '@shared/graph/types'
import { parseOutputConfig, parseOutputRoutes } from '@shared/output/config'
import type { FixtureRange } from '@shared/patch/layout'
import { universeCountFor } from '@shared/patch/types'
import { bakeFrames } from './bake'
import { FrameClock } from './FrameClock'
import { BufferPool } from './evaluator/BufferPool'
import { Evaluator } from './evaluator/Evaluator'
import { OutputManager } from './output/OutputManager'
import { OscListener } from './input/OscListener'

registerStandardNodes()

const config: EngineConfig = { ...DEFAULT_ENGINE_CONFIG }
const DEFAULT_PIXEL_COUNT = 170

const previewSab = new SharedArrayBuffer(MAX_PIXELS * CHANNELS_PER_PIXEL)
const pool = new BufferPool(DEFAULT_PIXEL_COUNT)
const evaluator = new Evaluator(previewSab, DEFAULT_PIXEL_COUNT, pool)
const output = new OutputManager()
const oscListener = new OscListener()

let rendererPort: MessagePortMain | null = null
let lastGraph: GraphData | null = null
let lastPatch: {
  positions: Float32Array
  count: number
  resolutionWidth: number
  resolutionHeight: number
  fixtureRanges: FixtureRange[]
} | null = null
const lastMediaFrames = new Map<string, MediaFrame>()
const lastAudioLevels = new Map<string, AudioLevels>()

function syncOutputs(): void {
  const routes = parseOutputRoutes(lastGraph, config.startUniverse)
  output.sync(routes, evaluator.getPixelCount(), config.iface ?? undefined, config.targetFps)

  const views = output.getOutputViews()
  const previewView = output.getPreviewView() ?? new Uint8Array(previewSab)
  evaluator.setOutputTargets(
    routes.map((r) => r.nodeId),
    views,
    previewView
  )
}
syncOutputs()

let fpsEma = 0
const FPS_SMOOTHING = 0.1

const clock = new FrameClock(config.targetFps, (timeMs, deltaMs) => {
  if (lastGraph !== null) {
    for (const node of lastGraph.nodes) {
      if (node.type === 'input/osc-in') {
        const v = oscListener.getValue(node.id)
        if (v !== undefined) evaluator.setOscState(node.id, v)
      }
    }
  }
  evaluator.evaluate(timeMs, deltaMs)
  if (deltaMs > 0) {
    fpsEma = fpsEma === 0 ? 1000 / deltaMs : fpsEma + FPS_SMOOTHING * (1000 / deltaMs - fpsEma)
  }
  postToRenderer({
    type: 'frame',
    pixels: evaluator.snapshot(),
    pixelCount: evaluator.getPixelCount(),
    previews: evaluator.previews,
    timings: evaluator.frameTimings
  })
})
clock.start()

const statusTimer = setInterval(() => {
  const pixelCount = evaluator.getPixelCount()
  const driver = parseOutputConfig(lastGraph, config.startUniverse)
  const activeCount = output.activeRouteCount
  postToRenderer({
    type: 'status',
    status: {
      fps: Math.round(fpsEma * 10) / 10,
      packetsPerSec: output.packetsPerSec,
      outputActive: output.enabled,
      startUniverse: driver.startUniverse,
      universeCount: universeCountFor(pixelCount),
      pixelCount,
      outputProtocol: driver.protocol,
      outputProtocolName: output.protocolName,
      outputError: output.lastError,
      graphError: evaluator.graphError,
      outputCount: activeCount,
      outputErrors: output.getRouteErrors()
    }
  })
}, 500)

function postToRenderer(msg: EngineToRenderer): void {
  rendererPort?.postMessage(msg)
}

function handleRendererMessage(msg: RendererToEngine): void {
  switch (msg.type) {
    case 'output-start':
      output.enable()
      break
    case 'output-stop':
      output.disable()
      break
    case 'load-project':
      Object.assign(config, msg.config)
      clock.setTargetFps(config.targetFps)
      lastGraph = msg.graph
      evaluator.setGraph(msg.graph)
      oscListener.syncGraph(msg.graph)
      lastPatch = {
        positions: msg.positions,
        count: msg.count,
        resolutionWidth: msg.resolutionWidth,
        resolutionHeight: msg.resolutionHeight,
        fixtureRanges: msg.fixtureRanges
      }
      evaluator.setPatch(
        msg.positions,
        msg.count,
        msg.resolutionWidth,
        msg.resolutionHeight,
        msg.fixtureRanges
      )
      syncOutputs()
      break
    case 'set-graph':
      lastGraph = msg.graph
      evaluator.setGraph(msg.graph)
      oscListener.syncGraph(msg.graph)
      syncOutputs()
      break
    case 'set-patch':
      lastPatch = {
        positions: msg.positions,
        count: msg.count,
        resolutionWidth: msg.resolutionWidth,
        resolutionHeight: msg.resolutionHeight,
        fixtureRanges: msg.fixtureRanges
      }
      evaluator.setPatch(
        msg.positions,
        msg.count,
        msg.resolutionWidth,
        msg.resolutionHeight,
        msg.fixtureRanges
      )
      syncOutputs()
      break
    case 'media-frame':
      lastMediaFrames.set(msg.nodeId, { width: msg.width, height: msg.height, data: msg.data })
      evaluator.setMediaFrame(msg.nodeId, msg.width, msg.height, msg.data)
      break
    case 'audio-levels':
      lastAudioLevels.set(msg.nodeId, {
        low: msg.low,
        mid: msg.mid,
        high: msg.high,
        beat: msg.beat ?? 0
      })
      evaluator.setAudioLevels(msg.nodeId, msg.low, msg.mid, msg.high, msg.beat ?? 0)
      break
    case 'midi-state':
      evaluator.setMidiState(msg.nodeId, msg.value, msg.velocity, msg.gate)
      break
    case 'keyboard-state':
      evaluator.setKeyboardState(msg.nodeId, msg.gate)
      break
    case 'bake':
      handleBake(msg.requestId, msg.durationMs, msg.fps)
      break
    case 'trigger':
      evaluator.fireTrigger(msg.nodeId, msg.port)
      break
    case 'set-config': {
      Object.assign(config, msg.config)
      clock.setTargetFps(config.targetFps)
      syncOutputs()
      break
    }
  }
}

function handleBake(requestId: number, durationMs: number, fps: number): void {
  if (lastGraph === null) {
    postToRenderer({
      type: 'bake-result',
      requestId,
      frames: new Uint8Array(0),
      frameCount: 0,
      pixelCount: 0,
      fps,
      error: 'No graph loaded'
    })
    return
  }

  const patch =
    lastPatch ??
    (() => {
      const positions = new Float32Array(DEFAULT_PIXEL_COUNT * 3)
      for (let i = 0; i < DEFAULT_PIXEL_COUNT; i++) positions[i * 3] = i
      return {
        positions,
        count: DEFAULT_PIXEL_COUNT,
        resolutionWidth: DEFAULT_PIXEL_COUNT,
        resolutionHeight: 1,
        fixtureRanges: [] as FixtureRange[]
      }
    })()

  const result = bakeFrames({
    graph: lastGraph,
    positions: patch.positions,
    pixelCount: patch.count,
    resolutionWidth: patch.resolutionWidth,
    resolutionHeight: patch.resolutionHeight,
    fixtureRanges: patch.fixtureRanges,
    mediaFrames: lastMediaFrames,
    audioLevels: lastAudioLevels,
    durationMs,
    fps
  })
  postToRenderer({ type: 'bake-result', requestId, ...result })
}

process.parentPort.on('message', (event) => {
  const data = event.data as { type?: string }
  if (data?.type === 'renderer-port' || data?.type === 'client-port') {
    rendererPort?.close()
    const port = event.ports[0]
    if (port === undefined) return
    rendererPort = port
    port.on('message', (e) => handleRendererMessage(e.data as RendererToEngine))
    port.start()
  } else if (data?.type === 'shutdown') {
    shutdown()
  }
})

function shutdown(): void {
  clock.stop()
  clearInterval(statusTimer)
  output.shutdown()
  rendererPort?.close()
  process.exit(0)
}
