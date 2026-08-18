import type { GraphData } from '../graph/types'
import { OUTPUT_NODE_TYPE } from '../graph/nodes'
import {
  parseColorMode,
  parseWhiteMode,
  type ColorMode,
  type WhiteMode
} from './rgbw'

export type OutputProtocolKind = 'sacn' | 'artnet' | 'ddp'

export interface OutputDriverConfig {
  protocol: OutputProtocolKind
  /** First universe for sACN / Art-Net (1-based, matches patch addressing). */
  startUniverse: number
  /** Optional sACN unicast destination; empty = standard multicast (239.255.x.x). */
  sacnHost: string
  /** DDP unicast/broadcast destination. */
  ddpHost: string
  ddpPort: number
  /** Wire colour mode. Internal frames stay RGB; RGBW is derived at send/export. */
  colorMode: ColorMode
  whiteMode: WhiteMode
}

export interface OutputRouteConfig extends OutputDriverConfig {
  nodeId: string
  /** Per-node transmit gate; false skips this route even when global output is on. */
  transmit: boolean
}

export const DEFAULT_OUTPUT_DRIVER: OutputDriverConfig = {
  protocol: 'sacn',
  startUniverse: 1,
  sacnHost: '',
  ddpHost: '255.255.255.255',
  ddpPort: 4048,
  colorMode: 'rgb',
  whiteMode: 'subtractive'
}

export const OUTPUT_PROTOCOL_LABELS: Record<OutputProtocolKind, string> = {
  sacn: 'sACN (E1.31)',
  artnet: 'Art-Net',
  ddp: 'DDP'
}

function strParam(params: Record<string, unknown>, name: string, fallback: string): string {
  const v = params[name]
  return typeof v === 'string' ? v : fallback
}

function intParam(params: Record<string, unknown>, name: string, fallback: number): number {
  const v = params[name]
  return typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback
}

/** Whether a Pixel Output node should transmit (default on). */
export function isOutputTransmitEnabled(params: Record<string, unknown>): boolean {
  return params['transmit'] !== false
}

export function parseOutputDriver(
  params: Record<string, unknown>,
  fallbackStartUniverse = DEFAULT_OUTPUT_DRIVER.startUniverse
): OutputDriverConfig {
  const protocolRaw = strParam(params, 'protocol', 'sacn')
  const protocol: OutputProtocolKind =
    protocolRaw === 'artnet' || protocolRaw === 'ddp' ? protocolRaw : 'sacn'

  return {
    protocol,
    startUniverse: Math.max(1, Math.min(63999, intParam(params, 'startUniverse', fallbackStartUniverse))),
    sacnHost: strParam(params, 'sacnHost', DEFAULT_OUTPUT_DRIVER.sacnHost),
    ddpHost: strParam(params, 'ddpHost', DEFAULT_OUTPUT_DRIVER.ddpHost),
    ddpPort: Math.max(1, Math.min(65535, intParam(params, 'ddpPort', DEFAULT_OUTPUT_DRIVER.ddpPort))),
    colorMode: parseColorMode(params['colorMode']),
    whiteMode: parseWhiteMode(params['whiteMode'])
  }
}

/** All Pixel Output nodes in graph order. */
export function parseOutputRoutes(
  graph: GraphData | null,
  fallbackStartUniverse = DEFAULT_OUTPUT_DRIVER.startUniverse
): OutputRouteConfig[] {
  if (graph === null) return []

  return graph.nodes
    .filter((n) => n.type === OUTPUT_NODE_TYPE)
    .map((node) => {
      const params = node.params as Record<string, unknown>
      return {
        nodeId: node.id,
        ...parseOutputDriver(params, fallbackStartUniverse),
        transmit: isOutputTransmitEnabled(params)
      }
    })
}

/** Read output settings from the first Pixel Output node in the graph. */
export function parseOutputConfig(
  graph: GraphData | null,
  fallbackStartUniverse = DEFAULT_OUTPUT_DRIVER.startUniverse
): OutputDriverConfig {
  const routes = parseOutputRoutes(graph, fallbackStartUniverse)
  if (routes.length === 0) {
    return { ...DEFAULT_OUTPUT_DRIVER, startUniverse: fallbackStartUniverse }
  }
  const first = routes[0] as OutputRouteConfig
  return {
    protocol: first.protocol,
    startUniverse: first.startUniverse,
    sacnHost: first.sacnHost,
    ddpHost: first.ddpHost,
    ddpPort: first.ddpPort,
    colorMode: first.colorMode,
    whiteMode: first.whiteMode
  }
}
