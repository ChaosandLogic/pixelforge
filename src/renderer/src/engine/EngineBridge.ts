import type { EngineToRenderer, RendererToEngine } from '@shared/messages'

type ConnectListener = () => void
const connectListeners = new Set<ConnectListener>()

/** Called whenever a fresh MessagePort to the engine host is attached. */
export function onEngineConnect(listener: ConnectListener): void {
  connectListeners.add(listener)
}

/**
 * Renderer side of the engine MessagePort. The port arrives via
 * window.postMessage from the preload (ports cannot cross the context
 * bridge). Outgoing messages are queued until the port is connected.
 */
export class EngineBridge {
  private port: MessagePort | null = null
  private queue: RendererToEngine[] = []

  constructor(private readonly onMessage: (msg: EngineToRenderer) => void) {
    window.addEventListener('message', (event: MessageEvent) => {
      const data = event.data as { type?: string } | undefined
      if (data?.type === 'pixelforge-engine-reconnect') {
        this.reconnect()
        return
      }
      if (data?.type !== 'pixelforge-engine-port') return
      const port = event.ports[0]
      if (port === undefined) return
      this.attach(port)
    })
    requestEnginePort()
  }

  private reconnect(): void {
    this.port?.close()
    this.port = null
    requestEnginePort()
  }

  send(msg: RendererToEngine): void {
    if (this.port === null) {
      this.queue.push(msg)
      return
    }
    this.port.postMessage(msg)
  }

  private attach(port: MessagePort): void {
    this.port?.close()
    this.port = port
    port.onmessage = (e: MessageEvent) => this.onMessage(e.data as EngineToRenderer)
    port.start()
    for (const msg of this.queue) port.postMessage(msg)
    this.queue = []
    for (const listener of connectListeners) listener()
  }
}

function requestEnginePort(): void {
  if (typeof window.pixelforge !== 'undefined') {
    window.pixelforge.requestEnginePort()
    return
  }
  if (typeof window.pixelforgePlayer !== 'undefined') {
    window.pixelforgePlayer.requestEnginePort()
  }
}
