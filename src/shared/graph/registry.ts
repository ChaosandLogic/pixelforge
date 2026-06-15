import type { NodeTypeDef } from './types'

const registry = new Map<string, NodeTypeDef>()

export function registerNodeType(def: NodeTypeDef): void {
  registry.set(def.type, def)
}

export function getNodeType(type: string): NodeTypeDef | undefined {
  return registry.get(type)
}

export function listNodeTypes(): NodeTypeDef[] {
  return [...registry.values()]
}
