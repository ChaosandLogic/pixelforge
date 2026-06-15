import { MIDI_IN_NODE_TYPE } from '@shared/graph/nodes/input/MidiIn'
import { intParam, stringParam } from '@shared/graph/types'
import { engineBridge } from '@/engine/bridge'
import { useGraphStore, type PfNode } from '@/store/graphStore'

interface MidiRoute {
  nodeId: string
  mode: 'note' | 'cc'
  channel: number
  number: number
}

let access: MIDIAccess | null = null
const routes = new Map<string, MidiRoute>()
let activeInput: MIDIInput | null = null
let activeDeviceId = ''

function parseRoute(node: PfNode): MidiRoute {
  const params = node.data.params
  const mode = stringParam(params, 'mode', 'note') === 'cc' ? 'cc' : 'note'
  return {
    nodeId: node.id,
    mode,
    channel: intParam(params, 'channel', 0),
    number: intParam(params, 'number', 60)
  }
}

function sendState(nodeId: string, value: number, velocity: number, gate: number): void {
  engineBridge.send({
    type: 'midi-state',
    nodeId,
    value,
    velocity,
    gate
  })
}

function handleMessage(nodeId: string, route: MidiRoute, data: Uint8Array): void {
  const status = data[0] ?? 0
  const cmd = status & 0xf0
  const ch = status & 0x0f
  if (ch !== route.channel) return

  if (route.mode === 'cc' && cmd === 0xb0) {
    const cc = data[1] ?? 0
    if (cc !== route.number) return
    const val = (data[2] ?? 0) / 127
    sendState(nodeId, val, val, val > 0 ? 1 : 0)
    return
  }

  if (route.mode === 'note') {
    const note = data[1] ?? 0
    if (note !== route.number) return
    const vel = (data[2] ?? 0) / 127
    if (cmd === 0x90 && vel > 0) {
      sendState(nodeId, vel, vel, 1)
    } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
      sendState(nodeId, 0, 0, 0)
    }
  }
}

function bindInput(deviceId: string): void {
  if (activeInput !== null) {
    activeInput.onmidimessage = null
    activeInput = null
  }
  if (access === null || deviceId === '') return
  const input = access.inputs.get(deviceId) ?? null
  if (input === null) return
  activeInput = input
  input.onmidimessage = (ev) => {
    const data = ev.data
    if (data === null) return
    for (const route of routes.values()) {
      handleMessage(route.nodeId, route, data)
    }
  }
}

async function ensureAccess(): Promise<void> {
  if (access !== null) return
  if (typeof navigator.requestMIDIAccess !== 'function') return
  access = await navigator.requestMIDIAccess()
  access.onstatechange = () => {
    if (activeDeviceId !== '') bindInput(activeDeviceId)
  }
}

function syncRoutes(nodes: PfNode[]): void {
  routes.clear()
  let deviceId = ''
  for (const n of nodes) {
    if (n.data.nodeType !== MIDI_IN_NODE_TYPE) continue
    routes.set(n.id, parseRoute(n))
    const d = stringParam(n.data.params, 'device', '')
    if (d !== '') deviceId = d
  }
  if (deviceId === '' && access !== null && access.inputs.size > 0) {
    deviceId = access.inputs.keys().next().value ?? ''
  }
  if (deviceId !== activeDeviceId) {
    activeDeviceId = deviceId
    bindInput(deviceId)
  }
}

export function initMidiManager(): void {
  void ensureAccess()
  useGraphStore.subscribe((state, prev) => {
    if (state.nodes === prev.nodes) return
    syncRoutes(state.nodes)
  })
  syncRoutes(useGraphStore.getState().nodes)
}

export function listMidiDevices(): string[] {
  if (access === null) return []
  return [...access.inputs.values()].map((i) => i.id)
}

export function midiDeviceName(id: string): string {
  if (access === null) return id
  return access.inputs.get(id)?.name ?? id
}
