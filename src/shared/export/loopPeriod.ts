import type { GraphData, NodeData } from '../graph/types'
import { OUTPUT_NODE_TYPE } from '../graph/nodes'
import { TIMELINE_NODE_TYPE, timelineLoopPeriodSec } from '../graph/nodes/time/Timeline'

const GRADIENT_NODE_TYPE = 'generator/gradient'
const SEQUENCE_NODE_TYPE = 'sequence/sequence'
import { sequenceLengthBeats } from '../sequence/evaluate'
import { parseSegments } from '../sequence/types'

const MIN_PERIOD_SEC = 0.05
const MAX_PERIOD_SEC = 3600
/** Largest denominator used when approximating a period as a rational number.
 * Bounds how "fine" a fractional period we try to align (e.g. 1/600 s steps). */
const MAX_RATIONAL_DEN = 600

function gcdInt(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = y
    y = x % y
    x = t
  }
  return Math.round(x)
}

function lcmInt(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return Math.abs(a / gcdInt(a, b)) * Math.abs(b)
}

/**
 * Approximate a positive real as a fraction num/den with a bounded denominator
 * using a continued-fraction expansion. This lets us combine periods like
 * 1/3 s and 1/2 s and recover their true common multiple (1 s) instead of the
 * garbage a fixed millisecond grid produces (gcd(333,500)=1 → 166.5 s).
 */
function toRational(x: number, maxDen = MAX_RATIONAL_DEN): { num: number; den: number } {
  if (!Number.isFinite(x) || x <= 0) return { num: 0, den: 1 }
  let h0 = 1
  let h1 = Math.floor(x)
  let k0 = 0
  let k1 = 1
  let frac = x - h1
  const tol = 1e-9
  while (frac > tol) {
    const inv = 1 / frac
    const a = Math.floor(inv)
    const h2 = a * h1 + h0
    const k2 = a * k1 + k0
    if (k2 > maxDen) break
    h0 = h1
    h1 = h2
    k0 = k1
    k1 = k2
    frac = inv - a
  }
  return { num: h1, den: k1 }
}

/**
 * Smallest period that is a whole-number multiple of both `a` and `b`, computed
 * in the rational domain: lcm(n1/d1, n2/d2) = lcm(n1,n2) / gcd(d1,d2). Returns
 * null when the result would exceed MAX_PERIOD_SEC (no practical clean loop).
 */
function lcmPeriodSec(a: number, b: number): number | null {
  if (a <= 0 || b <= 0) return Math.max(a, b)
  const ra = toRational(a)
  const rb = toRational(b)
  if (ra.num === 0 || rb.num === 0) return Math.max(a, b)
  const num = lcmInt(ra.num, rb.num)
  const den = gcdInt(ra.den, rb.den)
  if (den === 0) return Math.max(a, b)
  const period = num / den
  if (!Number.isFinite(period) || period > MAX_PERIOD_SEC) return null
  return period
}

function nodeFloat(node: NodeData, name: string, fallback: number): number {
  const value = node.params[name]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function isParamBound(node: NodeData, param: string): boolean {
  return node.paramBindings?.[param] !== undefined
}

function periodFromRateHz(rateHz: number): number | null {
  if (!Number.isFinite(rateHz) || Math.abs(rateHz) < 1e-6) return null
  const period = 1 / Math.abs(rateHz)
  if (period < MIN_PERIOD_SEC || period > MAX_PERIOD_SEC) return null
  return period
}

function addPeriod(
  periods: number[],
  sources: string[],
  periodSec: number | null,
  source: string
): void {
  if (periodSec === null) return
  periods.push(periodSec)
  sources.push(source)
}

export interface LoopPeriodResult {
  periodSec: number | null
  sources: string[]
}

/** Node IDs upstream of any Pixel Output (for loop detection scope). */
export function upstreamNodeIds(graph: GraphData): Set<string> {
  const upstream = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const list = upstream.get(edge.toNode)
    if (list === undefined) upstream.set(edge.toNode, [edge.fromNode])
    else list.push(edge.fromNode)
  }

  const reachable = new Set<string>()
  const stack = graph.nodes.filter((n) => n.type === OUTPUT_NODE_TYPE).map((n) => n.id)
  while (stack.length > 0) {
    const id = stack.pop()!
    if (reachable.has(id)) continue
    reachable.add(id)
    for (const from of upstream.get(id) ?? []) stack.push(from)
  }
  return reachable
}

function graphReachableFromOutput(graph: GraphData): GraphData {
  const reachable = upstreamNodeIds(graph)
  if (reachable.size === 0) return graph
  return { ...graph, nodes: graph.nodes.filter((n) => reachable.has(n.id)) }
}

function detectLoopPeriodFromNodes(graph: GraphData): LoopPeriodResult {
  const periods: number[] = []
  const sources: string[] = []

  for (const node of graph.nodes) {
    switch (node.type) {
      case GRADIENT_NODE_TYPE: {
        if (isParamBound(node, 'speed')) break
        const speed = nodeFloat(node, 'speed', 0)
        addPeriod(periods, sources, periodFromRateHz(speed), `${node.label ?? 'Gradient'} phase`)
        break
      }
      case 'time/lfo': {
        if (isParamBound(node, 'frequency')) break
        const frequency = nodeFloat(node, 'frequency', 0.25)
        addPeriod(periods, sources, periodFromRateHz(frequency), `${node.label ?? 'LFO'}`)
        break
      }
      case 'generator/wave': {
        if (isParamBound(node, 'speed')) break
        const speed = nodeFloat(node, 'speed', 0)
        addPeriod(periods, sources, periodFromRateHz(speed), `${node.label ?? 'Wave'} travel`)
        break
      }
      case 'generator/chase':
      case 'generator/comet': {
        if (isParamBound(node, 'speed')) break
        const speed = nodeFloat(node, 'speed', 0)
        addPeriod(periods, sources, periodFromRateHz(speed), `${node.label ?? node.type}`)
        break
      }
      case 'generator/strobe': {
        if (isParamBound(node, 'rate')) break
        const rate = nodeFloat(node, 'rate', 0)
        addPeriod(periods, sources, periodFromRateHz(rate), `${node.label ?? 'Strobe'}`)
        break
      }
      case 'transform/offset': {
        if (isParamBound(node, 'speed')) break
        const speed = nodeFloat(node, 'speed', 0)
        addPeriod(periods, sources, periodFromRateHz(speed), `${node.label ?? 'Offset'} scroll`)
        break
      }
      case 'time/ramp': {
        if (node.params['loop'] === false) break
        const seconds = nodeFloat(node, 'seconds', 2)
        if (seconds >= MIN_PERIOD_SEC && seconds <= MAX_PERIOD_SEC) {
          addPeriod(periods, sources, seconds, `${node.label ?? 'Ramp'}`)
        }
        break
      }
      case SEQUENCE_NODE_TYPE: {
        if (node.params['loop'] === false) break
        const bpm = nodeFloat(node, 'bpm', 120)
        if (bpm <= 0) break
        const beats = sequenceLengthBeats(parseSegments(node.params['segments']))
        if (beats <= 0) break
        const periodSec = (beats / bpm) * 60
        if (periodSec >= MIN_PERIOD_SEC && periodSec <= MAX_PERIOD_SEC) {
          addPeriod(periods, sources, periodSec, `${node.label ?? 'Sequence'}`)
        }
        break
      }
      case 'spatial/spherical':
      case 'spatial/cylindrical': {
        if (isParamBound(node, 'speed')) break
        const speed = nodeFloat(node, 'speed', 0)
        addPeriod(periods, sources, periodFromRateHz(speed), `${node.label ?? node.type}`)
        break
      }
      default:
        break
    }
  }

  if (periods.length === 0) return { periodSec: null, sources: [] }

  let combined: number | null = periods[0]!
  for (let i = 1; i < periods.length; i++) {
    combined = lcmPeriodSec(combined, periods[i]!)
    // Bail out early: once the combined loop exceeds the cap there is no
    // practical seamless loop, so report "not detected" and let the caller
    // fall back to the raw duration / a manual period.
    if (combined === null) return { periodSec: null, sources }
  }

  return { periodSec: combined, sources }
}

/** Infer a combined loop period from time-varying node parameters. */
export function detectLoopPeriod(graph: GraphData): LoopPeriodResult {
  const scoped = graphReachableFromOutput(graph)

  const loopingTimelines = scoped.nodes.filter(
    (node) => node.type === TIMELINE_NODE_TYPE && timelineLoopPeriodSec(node.params) !== null
  )
  if (loopingTimelines.length > 0) {
    const first = loopingTimelines[0]!
    const periodSec = timelineLoopPeriodSec(first.params)!
    return { periodSec, sources: [`${first.label ?? 'Timeline'}`] }
  }

  return detectLoopPeriodFromNodes(scoped)
}

/**
 * Node types whose output cannot repeat over a fixed period when animating:
 * stochastic/aperiodic generators and frame-stateful compositors. Mapped to the
 * param that, when zero (and unbound), makes them static (and therefore safe to
 * loop). `null` means "always non-repeating while present".
 */
const NON_LOOPABLE_TYPES: Record<string, string | null> = {
  'generator/twinkle': 'speed',
  'generator/fire': 'speed',
  'generator/noise': 'speed',
  'math/random': 'rate',
  'composite/feedback': null
}

/** Labels of reachable nodes that prevent a clean seamless loop. */
export function nonLoopableSources(graph: GraphData): string[] {
  const scoped = graphReachableFromOutput(graph)
  const labels: string[] = []
  for (const node of scoped.nodes) {
    if (!(node.type in NON_LOOPABLE_TYPES)) continue
    const param = NON_LOOPABLE_TYPES[node.type]
    if (param !== null && param !== undefined) {
      // Static (speed/rate 0 and not modulated) → loops fine, so skip it.
      if (!isParamBound(node, param) && nodeFloat(node, param, 0) === 0) continue
    }
    labels.push(node.label ?? node.type)
  }
  return labels
}

/** Shared export warnings (timeline conflicts, bake scope, non-loopable content). */
export function bakeExportWarnings(graph: GraphData): string[] {
  const warnings = [...timelineExportWarnings(graph)]
  const outputCount = graph.nodes.filter((n) => n.type === OUTPUT_NODE_TYPE).length
  if (outputCount > 1) {
    warnings.push(`Multiple Pixel Output nodes (${outputCount}) — bake uses only the first.`)
  }
  const nonLoopable = nonLoopableSources(graph)
  if (nonLoopable.length > 0) {
    warnings.push(
      `Contains non-repeating content (${nonLoopable.join(', ')}) — a seamless loop may ` +
        'not be achievable; the loop-match check reflects the actual seam.'
    )
  }
  return warnings
}

/** Warnings when multiple Timeline nodes disagree on loop length. */
export function timelineExportWarnings(graph: GraphData): string[] {
  const loopingTimelines = graph.nodes.filter(
    (node) => node.type === TIMELINE_NODE_TYPE && timelineLoopPeriodSec(node.params) !== null
  )
  if (loopingTimelines.length <= 1) return []

  const first = loopingTimelines[0]!
  const firstPeriod = timelineLoopPeriodSec(first.params)!
  const disagree = loopingTimelines.some((node) => {
    const period = timelineLoopPeriodSec(node.params)
    return period !== null && Math.abs(period - firstPeriod) > 0.001
  })
  if (!disagree) return []

  return [
    `Multiple Timeline nodes with different loop lengths — export uses “${first.label ?? 'Timeline'}” (${formatLoopPeriodSec(firstPeriod)}).`
  ]
}

export function snapDurationToLoop(durationSec: number, periodSec: number): number {
  const safeDuration = Math.max(1, durationSec)
  const safePeriod = Math.max(MIN_PERIOD_SEC, periodSec)
  const periods = Math.max(1, Math.round(safeDuration / safePeriod))
  return Math.max(safePeriod, periods * safePeriod)
}

export function resolveLoopBakeDuration(
  durationSec: number,
  seamlessLoop: boolean,
  periodMode: 'auto' | 'manual',
  manualPeriodSec: number,
  graph: GraphData
): { bakeDurationSec: number; periodSec: number | null; snapped: boolean } {
  if (!seamlessLoop) {
    return { bakeDurationSec: Math.max(1, durationSec), periodSec: null, snapped: false }
  }

  const detected = detectLoopPeriod(graph)
  const periodSec =
    periodMode === 'manual'
      ? manualPeriodSec > 0
        ? manualPeriodSec
        : null
      : detected.periodSec

  if (periodSec === null) {
    return { bakeDurationSec: Math.max(1, durationSec), periodSec: null, snapped: false }
  }

  const snappedDuration = snapDurationToLoop(durationSec, periodSec)
  return {
    bakeDurationSec: snappedDuration,
    periodSec,
    snapped: Math.abs(snappedDuration - durationSec) > 0.001
  }
}

export function formatLoopPeriodSec(periodSec: number): string {
  if (periodSec >= 10) return `${periodSec.toFixed(1)} s`
  if (periodSec >= 1) return `${periodSec.toFixed(2)} s`
  return `${periodSec.toFixed(3)} s`
}
