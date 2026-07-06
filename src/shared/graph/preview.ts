import { getNodeType } from './registry'
import type { NodeData } from './types'

/** Node preview raster: effect thumbnail vs physical LED layout. */
export type NodePreviewView = 'effect' | 'output'

/** Node thumbnails are shown unless explicitly disabled. */
export function isNodePreviewEnabled(preview?: boolean): boolean {
  return preview !== false
}

/** @deprecated Saved projects may still store `patch`; treated as `effect`. */
export type LegacyNodePreviewView = NodePreviewView | 'patch'

export function nodePreviewView(view?: LegacyNodePreviewView): NodePreviewView {
  return view === 'output' ? 'output' : 'effect'
}

/** Nodes whose primary output can be rasterised for thumbnails. */
export function nodeHasPreviewOutput(type: string): boolean {
  const port = getNodeType(type)?.outputs[0]
  return port?.type === 'pixels' || port?.type === 'float'
}

export function previewNodeIds(nodes: NodeData[]): string[] {
  return nodes
    .filter((n) => isNodePreviewEnabled(n.preview) && nodeHasPreviewOutput(n.type))
    .map((n) => n.id)
}

/** True when any enabled pixel preview is in effect (not output/layout) mode. */
export function needsEffectPreviewCapture(nodes: NodeData[], previewIds: string[]): boolean {
  for (const id of previewIds) {
    const node = nodes.find((n) => n.id === id)
    if (node === undefined || !isNodePreviewEnabled(node.preview)) continue
    const port = getNodeType(node.type)?.outputs[0]
    if (port?.type !== 'pixels') continue
    if (nodePreviewView(node.previewView) === 'effect') return true
  }
  return false
}
