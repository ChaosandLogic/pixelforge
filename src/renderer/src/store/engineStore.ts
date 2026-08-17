import { create } from 'zustand'
import {
  DEFAULT_ENGINE_CONFIG,
  type BakeResult,
  type EngineConfig,
  type EngineStatus,
  type NetworkInterfaceInfo,
  type NodePreviews,
  type NodeTimings
} from '@shared/messages'
import { engineBridge, onEngineMessage, onEngineConnect } from '@/engine/bridge'
import { getNetworkInterfaces } from '@/platform/api'

interface EngineState {
  status: EngineStatus
  config: EngineConfig
  /** Latest pixel frame from the engine (RGB triplets). */
  frame: Uint8Array | null
  framePixelCount: number
  /** Latest per-node output thumbnails. */
  previews: NodePreviews
  /** Latest per-node evaluate() durations (ms). */
  nodeTimings: NodeTimings
  interfaces: NetworkInterfaceInfo[]

  setOutputActive: (active: boolean) => void
  updateConfig: (patch: Partial<EngineConfig>) => void
  loadInterfaces: () => Promise<void>
  /** Offline-render the current graph in the engine host. Rejects on bake error. */
  bake: (durationMs: number, fps: number) => Promise<BakeResult>
}

const initialStatus: EngineStatus = {
  fps: 0,
  packetsPerSec: 0,
  outputActive: false,
  startUniverse: DEFAULT_ENGINE_CONFIG.startUniverse,
  universeCount: 1,
  pixelCount: 170,
  outputProtocol: 'sacn',
  outputProtocolName: 'sACN',
  outputError: null,
  graphError: null,
  outputCount: 0,
  outputErrors: {},
  shareAvailable: false,
  sharePlatform: 'none',
  shareSenders: [],
  shareError: null,
  gpuAvailable: false,
  gpuError: null
}

export const useEngineStore = create<EngineState>((set, get) => {
  let nextBakeId = 1
  const pendingBakes = new Map<
    number,
    { resolve: (result: BakeResult) => void; reject: (err: Error) => void; timer?: ReturnType<typeof setTimeout> }
  >()
  const BAKE_TIMEOUT_MS = 120_000

  onEngineMessage((msg) => {
    if (msg.type === 'frame') {
      set({
        frame: msg.pixels,
        framePixelCount: msg.pixelCount,
        previews: msg.previews,
        nodeTimings: msg.timings
      })
    } else if (msg.type === 'status') {
      set({ status: msg.status })
    } else if (msg.type === 'bake-result') {
      const pending = pendingBakes.get(msg.requestId)
      if (pending === undefined) return
      pendingBakes.delete(msg.requestId)
      if (pending.timer !== undefined) clearTimeout(pending.timer)
      if (msg.error !== null) pending.reject(new Error(msg.error))
      else pending.resolve(msg)
    }
  })

  onEngineConnect(() => {
    const { config, status } = get()
    engineBridge.send({ type: 'set-config', config })
    if (status.outputActive) engineBridge.send({ type: 'output-start' })
  })

  return {
    status: initialStatus,
    config: { ...DEFAULT_ENGINE_CONFIG },
    frame: null,
    framePixelCount: 170,
    previews: {},
    nodeTimings: {},
    interfaces: [],

    setOutputActive: (active) => {
      set({ status: { ...get().status, outputActive: active } })
      engineBridge.send({ type: active ? 'output-start' : 'output-stop' })
    },

    updateConfig: (patch) => {
      const config = { ...get().config, ...patch }
      set({ config })
      engineBridge.send({ type: 'set-config', config: patch })
    },

    loadInterfaces: async () => {
      const interfaces = await getNetworkInterfaces()
      set({ interfaces })
    },

    bake: (durationMs, fps) => {
      const requestId = nextBakeId++
      return new Promise<BakeResult>((resolve, reject) => {
        // Guard against a lost/never-arriving bake-result (engine crash, port
        // loss) so export dialogs can't stay stuck on "Baking frames…".
        const timer = setTimeout(() => {
          if (pendingBakes.delete(requestId)) {
            reject(new Error('Bake timed out — the engine did not respond.'))
          }
        }, BAKE_TIMEOUT_MS)
        pendingBakes.set(requestId, { resolve, reject, timer })
        engineBridge.send({ type: 'bake', requestId, durationMs, fps })
      })
    }
  }
})
