import { getNodeType } from './registry'
import type { NodeData } from './types'

/** Node preview raster: logical stream grid vs physical LED layout. */
export type NodePreviewView = 'patch' | 'output'

/** Node thumbnails are shown unless explicitly disabled. */
export function isNodePreviewEnabled(preview?: boolean): boolean {
  return preview !== false
}

export function nodePreviewView(view?: NodePreviewView): NodePreviewView {
  return view === 'patch' ? 'patch' : 'output'
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
