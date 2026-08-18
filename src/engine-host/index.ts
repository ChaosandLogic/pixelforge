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
import { mergeShareSenders } from '@shared/share/senders'
import { bakeFrames } from './bake'
import { FrameClock } from './FrameClock'
import { BufferPool } from './evaluator/BufferPool'
import { Evaluator } from './evaluator/Evaluator'
import { OutputManager } from './output/OutputManager'
import { OscListener } from './input/OscListener'
import { TextureShare } from './share/TextureShare'
import { GpuClient } from './gpu/GpuClient'
import { gpuEnginePath } from './gpu/path'

registerStandardNodes()

const config: EngineConfig = { ...DEFAULT_ENGINE_CONFIG }
const DEFAULT_PIXEL_COUNT = 170

const previewSab = new SharedArrayBuffer(MAX_PIXELS * CHANNELS_PER_PIXEL)
const pool = new BufferPool(DEFAULT_PIXEL_COUNT)
const evaluator = new Evaluator(previewSab, DEFAULT_PIXEL_COUNT, pool)
const output = new OutputManager()
const oscListener = new OscListener()
const share = new TextureShare()
let gpu: GpuClient | null = null
let gpuCrashTimes: number[] = []
let gpuRestartTimer: ReturnType<typeof setTimeout> | null = null

function attachGpu(): void {
  const path = gpuEnginePath()
  if (path === null) {
    evaluator.setGpuClient(null)
    return
  }
  const client = new GpuClient(path, () => {
    evaluator.setGpuClient(null)
    const now = Date.now()
    gpuCrashTimes = gpuCrashTimes.filter((t) => now - t < 15_000)
    gpuCrashTimes.push(now)
    if (gpuCrashTimes.length > 5) {
      console.error('[gpu-engine] giving up after repeated crashes; falling back to CPU TOPs')
      return
    }
    if (gpuRestartTimer !== null) clearTimeout(gpuRestartTimer)
    gpuRestartTimer = setTimeout(() => {
      gpuRestartTimer = null
      attachGpu()
    }, 400)
  })
  if (client.start()) {
    gpu = client
    evaluator.setGpuClient(client)
  } else {
    gpu = null
    evaluator.setGpuClient(null)
  }
}
attachGpu()

const gpuShareActive = (): boolean => gpu?.available === true && gpu.hello?.share !== 'none'

let rendererPort: MessagePortMain | null = null
let clientPort: MessagePortMain | null = null
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
  const controls = output.getControlViews()
  const previewView = output.getPreviewView() ?? new Uint8Array(previewSab)
  evaluator.setOutputTargets(
    routes.map((r) => r.nodeId),
    views,
    previewView,
    controls
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
    share.receive(evaluator, lastGraph)
  }
  evaluator.evaluate(timeMs, deltaMs)
  if (lastGraph !== null && !gpuShareActive()) share.publish(evaluator, lastGraph)
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
  share.pollDiscovery()
  if (gpuShareActive()) {
    const listed = gpu?.listSenders() ?? []
    if (listed.length > 0) evaluator.gpuShareSenders = listed
  }
  postToRenderer({
    type: 'status',
    status: {
      fps: Math.round(fpsEma * 10) / 10,
      packetsPerSec: output.packetsPerSec,
      outputActive: output.enabled,
      startUniverse: driver.startUniverse,
      universeCount: universeCountFor(pixelCount, driver.colorMode),
      pixelCount,
      outputProtocol: driver.protocol,
      outputProtocolName: output.protocolName,
      colorMode: driver.colorMode,
      outputError: output.lastError,
      graphError: evaluator.graphError ?? evaluator.evalError,
      outputCount: activeCount,
      outputErrors: output.getRouteErrors(),
      shareAvailable: gpuShareActive() || share.status.available,
      sharePlatform: gpuShareActive() ? evaluator.gpuSharePlatform : share.status.platform,
      shareSenders: mergeShareSenders(share.status.senders, evaluator.gpuShareSenders),
      shareError: gpuShareActive() ? evaluator.gpuShareError : share.status.error,
      gpuAvailable: evaluator.gpuEnabled,
      gpuError: gpu?.lastError ?? null
    }
  })
}, 500)

function postToRenderer(msg: EngineToRenderer): void {
  const port = rendererPort ?? clientPort
  port?.postMessage(msg)
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
      share.syncGraph(msg.graph, evaluator, { senders: !gpuShareActive() })
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
      share.syncGraph(msg.graph, evaluator, { senders: !gpuShareActive() })
      syncOutputs()
      break
    case 'patch-node-params': {
      evaluator.patchNodeParams(msg.nodeId, msg.params)
      const node = lastGraph?.nodes.find((n) => n.id === msg.nodeId)
      if (node !== undefined) Object.assign(node.params, msg.params)
      share.syncGraph(lastGraph, evaluator, { senders: !gpuShareActive() })
      break
    }
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
      seamFrame: null,
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

  clock.stop()
  evaluator.setGpuClient(null)
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
    fps,
    gpu
  })
  evaluator.setGpuClient(gpu)
  clock.start()
  postToRenderer({ type: 'bake-result', requestId, ...result })
}

function attachIncomingPort(port: MessagePortMain): void {
  port.on('message', (e) => handleRendererMessage(e.data as RendererToEngine))
  port.start()
}

process.parentPort.on('message', (event) => {
  const data = event.data as { type?: string }
  const port = event.ports[0]
  if (data?.type === 'renderer-port') {
    rendererPort?.close()
    if (port === undefined) return
    rendererPort = port
    attachIncomingPort(port)
  } else if (data?.type === 'client-port') {
    clientPort?.close()
    if (port === undefined) return
    clientPort = port
    attachIncomingPort(port)
  } else if (data?.type === 'shutdown') {
    shutdown()
  }
})

function shutdown(): void {
  clock.stop()
  clearInterval(statusTimer)
  if (gpuRestartTimer !== null) clearTimeout(gpuRestartTimer)
  gpu?.stop()
  output.shutdown()
  share.dispose()
  oscListener.dispose()
  rendererPort?.close()
  clientPort?.close()
  process.exit(0)
}
