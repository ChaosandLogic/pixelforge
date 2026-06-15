import { CHANNELS_PER_PIXEL, MAX_PIXELS } from '@shared/messages'
import type { OutputRouteConfig } from '@shared/output/config'
import { OutputSender } from './OutputSender'
import type { FromOutputWorker } from './workerMessages'

interface OutputRoute {
  sab: SharedArrayBuffer
  view: Uint8Array
  sender: OutputSender
  transmit: boolean
  protocolName: string
  packetsPerSec: number
  lastError: string | null
}

/**
 * One output worker per Pixel Output node. Each route reads its own
 * SharedArrayBuffer so multiple streams can transmit in parallel.
 */
export class OutputManager {
  private routes = new Map<string, OutputRoute>()
  private globalEnabled = false
  private pixelCount = 170

  packetsPerSec = 0
  lastError: string | null = null
  protocolName = 'sACN'

  /** Views keyed by output node id — passed to the evaluator each sync. */
  getOutputViews(): Map<string, Uint8Array> {
    return new Map([...this.routes.entries()].map(([id, route]) => [id, route.view]))
  }

  /** Preview buffer: first route in graph order, or null when no outputs exist. */
  getPreviewView(): Uint8Array | null {
    const first = this.routes.values().next().value as OutputRoute | undefined
    return first?.view ?? null
  }

  get enabled(): boolean {
    return this.globalEnabled && [...this.routes.values()].some((r) => r.transmit && r.sender.enabled)
  }

  get activeRouteCount(): number {
    if (!this.globalEnabled) return 0
    return [...this.routes.values()].filter((r) => r.transmit && r.sender.enabled).length
  }

  sync(routes: OutputRouteConfig[], pixelCount: number, iface: string | undefined, targetFps: number): void {
    this.pixelCount = Math.max(1, Math.min(MAX_PIXELS, Math.floor(pixelCount)))
    const bytesPerRoute = this.pixelCount * CHANNELS_PER_PIXEL

    const nextIds = new Set(routes.map((r) => r.nodeId))
    for (const id of [...this.routes.keys()]) {
      if (!nextIds.has(id)) this.removeRoute(id)
    }

    for (const route of routes) {
      let existing = this.routes.get(route.nodeId)
      if (existing !== undefined && existing.sab.byteLength !== bytesPerRoute) {
        this.removeRoute(route.nodeId)
        existing = undefined
      }
      if (existing === undefined) {
        existing = this.createRoute(route.nodeId)
        this.routes.set(route.nodeId, existing)
      }
      existing.transmit = route.transmit
      existing.sender.configure({
        protocol: route.protocol,
        startUniverse: route.startUniverse,
        sacnHost: route.sacnHost,
        ddpHost: route.ddpHost,
        ddpPort: route.ddpPort,
        iface,
        targetFps,
        pixelCount: this.pixelCount
      })
    }

    this.applyEnableState()
    this.aggregateStats()
  }

  enable(): void {
    this.globalEnabled = true
    this.applyEnableState()
  }

  disable(): void {
    this.globalEnabled = false
    for (const route of this.routes.values()) route.sender.disable()
  }

  shutdown(): void {
    for (const id of [...this.routes.keys()]) this.removeRoute(id)
  }

  getRouteErrors(): Record<string, string | null> {
    const errors: Record<string, string | null> = {}
    for (const [id, route] of this.routes) {
      if (route.transmit) errors[id] = route.lastError
    }
    return errors
  }

  private createRoute(nodeId: string): OutputRoute {
    const sab = new SharedArrayBuffer(this.pixelCount * CHANNELS_PER_PIXEL)
    const route: OutputRoute = {
      sab,
      view: new Uint8Array(sab),
      sender: new OutputSender(sab, (msg) => this.onRouteStats(nodeId, msg)),
      transmit: true,
      protocolName: 'sACN',
      packetsPerSec: 0,
      lastError: null
    }
    return route
  }

  private removeRoute(nodeId: string): void {
    const route = this.routes.get(nodeId)
    if (route === undefined) return
    route.sender.shutdown()
    this.routes.delete(nodeId)
  }

  private onRouteStats(nodeId: string, msg: FromOutputWorker): void {
    if (msg.type !== 'stats') return
    const route = this.routes.get(nodeId)
    if (route === undefined) return
    route.packetsPerSec = msg.packetsPerSec
    route.lastError = msg.lastError
    route.protocolName = msg.protocolName
    this.aggregateStats()
  }

  private aggregateStats(): void {
    let packets = 0
    let error: string | null = null
    const activeNames: string[] = []

    for (const route of this.routes.values()) {
      if (!route.transmit) continue
      packets += route.packetsPerSec
      if (error === null && route.lastError !== null) error = route.lastError
      if (this.globalEnabled && route.sender.enabled) activeNames.push(route.protocolName)
    }

    this.packetsPerSec = packets
    this.lastError = error

    const activeCount = activeNames.length
    if (activeCount === 0) {
      const first = this.routes.values().next().value as OutputRoute | undefined
      this.protocolName = first?.protocolName ?? 'sACN'
    } else if (activeCount === 1) {
      this.protocolName = activeNames[0] as string
    } else {
      this.protocolName = `${activeCount} outputs`
    }
  }

  private applyEnableState(): void {
    for (const route of this.routes.values()) {
      if (this.globalEnabled && route.transmit) route.sender.enable()
      else route.sender.disable()
    }
    this.aggregateStats()
  }
}
