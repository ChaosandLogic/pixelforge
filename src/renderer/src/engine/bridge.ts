import type { EngineToRenderer } from '@shared/messages'
import { EngineBridge, onEngineConnect as registerEngineConnect } from './EngineBridge'

/**
 * Singleton engine bridge with a listener registry, so multiple stores
 * (engine status, graph) can share the one MessagePort.
 */
type Listener = (msg: EngineToRenderer) => void

const listeners = new Set<Listener>()

export const engineBridge = new EngineBridge((msg) => {
  for (const listener of listeners) listener(msg)
})

export function onEngineMessage(listener: Listener): void {
  listeners.add(listener)
}

export const onEngineConnect = registerEngineConnect
