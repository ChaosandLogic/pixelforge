import { KEYBOARD_IN_NODE_TYPE } from '@shared/graph/nodes/input/KeyboardIn'
import { stringParam, type ParamValues } from '@shared/graph/types'
import { engineBridge } from '@/engine/bridge'
import { useGraphStore, type PfNode } from '@/store/graphStore'

interface KeyboardRoute {
  nodeId: string
  key: string
  shift: boolean
  ctrl: boolean
  alt: boolean
  meta: boolean
}

const routes = new Map<string, KeyboardRoute>()

export interface LocalKeyboardState {
  gate: number
  /** performance.now() timestamp of the latest trigger (keydown). */
  triggerAt: number
}

const localState = new Map<string, LocalKeyboardState>()

function setLocalGate(nodeId: string, gate: number): void {
  const prev = localState.get(nodeId)
  const triggerAt =
    gate === 1 && (prev?.gate ?? 0) === 0 ? performance.now() : (prev?.triggerAt ?? 0)
  localState.set(nodeId, { gate, triggerAt })
}

export function getLocalKeyboardState(nodeId: string): LocalKeyboardState | null {
  return localState.get(nodeId) ?? null
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

function parseRoute(node: PfNode): KeyboardRoute {
  const params = node.data.params
  return {
    nodeId: node.id,
    key: stringParam(params, 'key', 'Enter'),
    shift: boolParam(params, 'shift', false),
    ctrl: boolParam(params, 'ctrl', false),
    alt: boolParam(params, 'alt', false),
    meta: boolParam(params, 'meta', false)
  }
}

function boolParam(params: ParamValues, name: string, fallback: boolean): boolean {
  const v = params[name]
  return typeof v === 'boolean' ? v : fallback
}

function matchesRoute(event: KeyboardEvent, route: KeyboardRoute): boolean {
  if (route.key === '') return false
  if (event.key !== route.key && event.code !== route.key) return false
  if (route.shift !== event.shiftKey) return false
  if (route.ctrl !== event.ctrlKey) return false
  if (route.alt !== event.altKey) return false
  if (route.meta !== event.metaKey) return false
  return true
}

function sendGate(nodeId: string, gate: number): void {
  setLocalGate(nodeId, gate)
  engineBridge.send({ type: 'keyboard-state', nodeId, gate })
}

function syncRoutes(nodes: PfNode[]): void {
  const nextIds = new Set<string>()
  for (const node of nodes) {
    if (node.data.nodeType !== KEYBOARD_IN_NODE_TYPE) continue
    nextIds.add(node.id)
    const route = parseRoute(node)
    routes.set(node.id, route)
    if (!localState.has(node.id)) localState.set(node.id, { gate: 0, triggerAt: 0 })
  }
  for (const id of routes.keys()) {
    if (!nextIds.has(id)) {
      routes.delete(id)
      localState.delete(id)
    }
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (isTypingTarget(event.target)) return

  let handled = false
  for (const route of routes.values()) {
    if (!matchesRoute(event, route)) continue
    handled = true
    sendGate(route.nodeId, 1)
  }

  if (handled) event.preventDefault()
}

function handleKeyUp(event: KeyboardEvent): void {
  if (isTypingTarget(event.target)) return

  for (const route of routes.values()) {
    if (!matchesRoute(event, route)) continue
    sendGate(route.nodeId, 0)
  }
}

export function formatKeyLabel(key: string): string {
  if (key === ' ') return 'Space'
  if (key === 'ArrowUp') return '↑'
  if (key === 'ArrowDown') return '↓'
  if (key === 'ArrowLeft') return '←'
  if (key === 'ArrowRight') return '→'
  return key
}

export function formatKeyboardBinding(params: ParamValues): string {
  const parts: string[] = []
  if (boolParam(params, 'meta', false)) parts.push('Cmd')
  if (boolParam(params, 'ctrl', false)) parts.push('Ctrl')
  if (boolParam(params, 'alt', false)) parts.push('Alt')
  if (boolParam(params, 'shift', false)) parts.push('Shift')
  parts.push(formatKeyLabel(stringParam(params, 'key', 'Enter')))
  return parts.join('+')
}

export function initKeyboardManager(): void {
  syncRoutes(useGraphStore.getState().nodes)
  useGraphStore.subscribe((state, prev) => {
    if (state.nodes === prev.nodes) return
    syncRoutes(state.nodes)
  })

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
}
