/** Syphon/Spout sender labels used by the node dropdown and native receivers. */

import { SYPHON_IN_NODE_TYPE, syphonSenderName } from '../graph/nodes/generators/SyphonIn'
import type { GraphData } from '../graph/types'

export interface ShareSenderInfo {
  name?: string
  appName?: string
  uuid?: string
}

export interface ShareInputSub {
  nodeId: string
  sender: string
}

const COMPOSITE_SEP = ' — '

export function shareSenderLabel(info: ShareSenderInfo | string): string {
  if (typeof info === 'string') return info.trim()
  const name = (info.name ?? '').trim()
  const app = (info.appName ?? '').trim()
  if (app !== '' && name !== '' && app !== name) return `${app}${COMPOSITE_SEP}${name}`
  return name || app
}

export function parseShareSender(label: string): { name: string; appName?: string } {
  const trimmed = label.trim()
  const idx = trimmed.indexOf(COMPOSITE_SEP)
  if (idx > 0) {
    const appName = trimmed.slice(0, idx).trim()
    const name = trimmed.slice(idx + COMPOSITE_SEP.length).trim()
    if (appName !== '' && name !== '') return { name, appName }
  }
  return { name: trimmed }
}

export function mergeShareSenders(...lists: string[][]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const list of lists) {
    for (const name of list) {
      if (name === '' || seen.has(name)) continue
      seen.add(name)
      out.push(name)
    }
  }
  return out
}

export function shareInputsFromGraph(graph: GraphData | null | undefined): ShareInputSub[] {
  if (graph === null || graph === undefined) return []
  const out: ShareInputSub[] = []
  for (const node of graph.nodes) {
    if (node.type !== SYPHON_IN_NODE_TYPE) continue
    const sender = syphonSenderName(node.params)
    if (sender !== '') out.push({ nodeId: node.id, sender })
  }
  return out
}
