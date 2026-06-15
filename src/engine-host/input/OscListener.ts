import dgram from 'node:dgram'
import type { GraphData } from '@shared/graph/types'
import { OSC_IN_NODE_TYPE, oscAddress, oscPort } from '@shared/graph/nodes/input/OscIn'

interface Route {
  nodeId: string
  address: string
}

/** Minimal OSC UDP listener — routes float args to OSC In nodes by address. */
export class OscListener {
  private socket: dgram.Socket | null = null
  private port = 0
  private routes: Route[] = []
  private values = new Map<string, number>()

  syncGraph(graph: GraphData | null): void {
    this.routes = []
    if (graph === null) return
    for (const node of graph.nodes) {
      if (node.type !== OSC_IN_NODE_TYPE) continue
      this.routes.push({ nodeId: node.id, address: oscAddress(node.params) })
    }
    const ports = new Set<number>()
    for (const node of graph.nodes) {
      if (node.type === OSC_IN_NODE_TYPE) ports.add(oscPort(node.params))
    }
    const nextPort = ports.size > 0 ? Math.min(...ports) : 9000
    if (nextPort !== this.port || this.socket === null) {
      this.rebind(nextPort)
    }
  }

  private rebind(port: number): void {
    if (this.socket !== null) {
      this.socket.close()
      this.socket = null
    }
    this.port = port
    const sock = dgram.createSocket('udp4')
    sock.on('message', (msg) => this.onMessage(msg))
    sock.on('error', () => {
      // Port in use — ignore.
    })
    sock.bind(port)
    this.socket = sock
  }

  private onMessage(msg: Buffer): void {
    const parsed = parseOscFloat(msg)
    if (parsed === null) return
    for (const route of this.routes) {
      if (route.address === parsed.address || route.address === '*') {
        this.values.set(route.nodeId, parsed.value)
      }
    }
  }

  getValue(nodeId: string): number | undefined {
    return this.values.get(nodeId)
  }

  dispose(): void {
    if (this.socket !== null) {
      this.socket.close()
      this.socket = null
    }
  }
}

function parseOscFloat(msg: Buffer): { address: string; value: number } | null {
  let offset = 0
  const readString = (): string | null => {
    const start = offset
    while (offset < msg.length && msg[offset] !== 0) offset++
    if (offset >= msg.length) return null
    const s = msg.toString('utf8', start, offset)
    offset++
    while (offset < msg.length && offset % 4 !== 0) offset++
    return s
  }

  const address = readString()
  if (address === null || !address.startsWith('/')) return null
  const tags = readString()
  if (tags === null || !tags.startsWith(',')) return null

  for (let i = 1; i < tags.length; i++) {
    const tag = tags[i]
    if (tag === 'f' && offset + 4 <= msg.length) {
      const value = msg.readFloatBE(offset)
      return { address, value: Math.max(0, Math.min(1, value > 1 ? value / 127 : value)) }
    }
    if (tag === 'i' && offset + 4 <= msg.length) {
      const value = msg.readInt32BE(offset)
      return { address, value: Math.max(0, Math.min(1, value / 127)) }
    }
    if (tag === 'f') offset += 4
    else if (tag === 'i') offset += 4
    else if (tag === 's') {
      while (offset < msg.length && msg[offset] !== 0) offset++
      offset++
      while (offset < msg.length && offset % 4 !== 0) offset++
    }
  }
  return null
}
