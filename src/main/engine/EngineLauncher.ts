import {
  BrowserWindow,
  MessageChannelMain,
  utilityProcess,
  type UtilityProcess,
  type WebContents
} from 'electron'
import type { EngineToRenderer, RendererToEngine } from '@shared/messages'
import { engineHostPath } from './paths'
import { gpuEnginePath } from './gpuEnginePath'
import { ENGINE_RESTART_DELAY_MS, recordEngineCrash } from './engineRestart'

type EngineMessageListener = (msg: EngineToRenderer) => void
type EngineRestartListener = () => void

/**
 * Spawns the engine host as a utilityProcess and wires MessagePorts between
 * it and renderer windows or the main process (Player / headless bootstrap).
 */
export class EngineLauncher {
  private proc: UtilityProcess | null = null
  private clientPort: Electron.MessagePortMain | null = null
  private messageListeners = new Set<EngineMessageListener>()
  private restartListeners = new Set<EngineRestartListener>()
  private outboundQueue: RendererToEngine[] = []
  private stopping = false
  private wantsClientPort = false
  private crashTimestamps: number[] = []
  private restartTimer: ReturnType<typeof setTimeout> | null = null

  start(): void {
    this.stopping = false
    if (this.proc !== null) return
    const gpuPath = gpuEnginePath()
    this.proc = utilityProcess.fork(engineHostPath(), [], {
      serviceName: 'pixelforge-engine',
      env: {
        ...process.env,
        ...(gpuPath !== null ? { PIXELFORGE_GPU_ENGINE: gpuPath } : {})
      }
    })
    this.proc.on('exit', (code) => {
      console.error(`[engine] exited with code ${code}`)
      this.proc = null
      this.clientPort?.close()
      this.clientPort = null
      if (this.stopping) return
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('engine:reconnect')
      }
      this.scheduleRestart()
    })
  }

  /** Called after an unexpected engine respawn (project must be re-pushed). */
  onRestart(listener: EngineRestartListener): () => void {
    this.restartListeners.add(listener)
    return () => this.restartListeners.delete(listener)
  }

  /** Subscribe to engine messages on the main-process client port. */
  onMessage(listener: EngineMessageListener): () => void {
    this.messageListeners.add(listener)
    return () => this.messageListeners.delete(listener)
  }

  /** Ensure a MessagePort exists for main-process → engine communication. */
  ensureClientPort(): void {
    this.wantsClientPort = true
    if (this.clientPort !== null) return
    if (this.proc === null) this.start()
    const { port1, port2 } = new MessageChannelMain()
    this.attachClientPort(port1)
    this.proc?.postMessage({ type: 'client-port' }, [port2])
  }

  sendToEngine(msg: RendererToEngine): void {
    if (this.clientPort === null) {
      this.outboundQueue.push(msg)
      return
    }
    this.clientPort.postMessage(msg)
  }

  /** Create a fresh channel pair: one end to the engine, one to the renderer. */
  connectRenderer(webContents: WebContents): void {
    if (this.proc === null) this.start()
    const { port1, port2 } = new MessageChannelMain()
    this.proc?.postMessage({ type: 'renderer-port' }, [port1])
    webContents.postMessage('engine-port', null, [port2])
  }

  stop(): void {
    this.stopping = true
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    this.proc?.postMessage({ type: 'shutdown' })
    this.proc?.kill()
    this.proc = null
    this.clientPort?.close()
    this.clientPort = null
    this.outboundQueue = []
  }

  private scheduleRestart(): void {
    const recorded = recordEngineCrash(this.crashTimestamps, Date.now())
    this.crashTimestamps = recorded.timestamps
    if (!recorded.restart) {
      console.error('[engine] giving up after repeated crashes; output will stay down until relaunch')
      return
    }
    if (this.restartTimer !== null) clearTimeout(this.restartTimer)
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      if (this.stopping) return
      if (this.proc === null) this.start()
      if (this.wantsClientPort) this.ensureClientPort()
      for (const listener of this.restartListeners) listener()
    }, ENGINE_RESTART_DELAY_MS)
  }

  private attachClientPort(port: Electron.MessagePortMain): void {
    this.clientPort?.close()
    this.clientPort = port
    port.on('message', (event) => {
      const msg = event.data as EngineToRenderer
      for (const listener of this.messageListeners) listener(msg)
    })
    port.start()
    for (const msg of this.outboundQueue) port.postMessage(msg)
    this.outboundQueue = []
  }
}
