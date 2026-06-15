import {
  BrowserWindow,
  MessageChannelMain,
  utilityProcess,
  type UtilityProcess,
  type WebContents
} from 'electron'
import type { EngineToRenderer, RendererToEngine } from '@shared/messages'
import { engineHostPath } from './paths'

type EngineMessageListener = (msg: EngineToRenderer) => void

/**
 * Spawns the engine host as a utilityProcess and wires MessagePorts between
 * it and renderer windows or the main process (Player / headless bootstrap).
 */
export class EngineLauncher {
  private proc: UtilityProcess | null = null
  private clientPort: Electron.MessagePortMain | null = null
  private messageListeners = new Set<EngineMessageListener>()
  private outboundQueue: RendererToEngine[] = []

  start(): void {
    if (this.proc !== null) return
    this.proc = utilityProcess.fork(engineHostPath(), [], {
      serviceName: 'pixelforge-engine',
      env: { ...process.env }
    })
    this.proc.on('exit', (code) => {
      console.error(`[engine] exited with code ${code}`)
      this.proc = null
      this.clientPort?.close()
      this.clientPort = null
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('engine:reconnect')
      }
    })
  }

  /** Subscribe to engine messages on the main-process client port. */
  onMessage(listener: EngineMessageListener): () => void {
    this.messageListeners.add(listener)
    return () => this.messageListeners.delete(listener)
  }

  /** Ensure a MessagePort exists for main-process → engine communication. */
  ensureClientPort(): void {
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
    this.proc?.postMessage({ type: 'shutdown' })
    this.proc?.kill()
    this.proc = null
    this.clientPort?.close()
    this.clientPort = null
    this.outboundQueue = []
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
