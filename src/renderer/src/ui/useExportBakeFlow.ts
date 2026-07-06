import { useMemo, useState } from 'react'
import {
  detectLoopPeriod,
  formatLoopPeriodSec,
  resolveLoopBakeDuration,
  type LoopPeriodResult
} from '@shared/export/loopPeriod'
import { formatLoopSeam, measureLoopSeam, seamWarningThreshold } from '@shared/export/loopSeam'
import { DEFAULT_TARGET_FPS } from '@shared/messages'
import type { GraphData } from '@shared/graph/types'
import { useEngineStore } from '@/store/engineStore'
import { useGraphStore } from '@/store/graphStore'
import { usePatchStore } from '@/store/patchStore'

export interface BakeResult {
  frames: Uint8Array
  frameCount: number
  pixelCount: number
  fps: number
  /** Loop-boundary frame for seam measurement; not part of the export. */
  seamFrame: Uint8Array | null
}

export interface ExportPreflightResult {
  canExport: boolean
  errors: string[]
  warnings: string[]
}

export interface LoopBakeState {
  bakeDurationSec: number
  periodSec: number | null
  snapped: boolean
}

export interface ExportBakeFlow {
  durationSec: number
  setDurationSec: (value: number) => void
  fps: number
  setFps: (value: number) => void
  seamlessLoop: boolean
  setSeamlessLoop: (value: boolean) => void
  periodMode: 'auto' | 'manual'
  setPeriodMode: (mode: 'auto' | 'manual') => void
  manualPeriodSec: number
  setManualPeriodSec: (value: number) => void
  busy: boolean
  status: string | null
  setStatus: (value: string | null) => void
  graph: GraphData
  pixelCount: number
  detectedPeriod: LoopPeriodResult
  loopBake: LoopBakeState
  activePeriodSec: number | null
  preflight: ExportPreflightResult
  runBake: () => Promise<BakeResult | null>
}

export function useExportBakeFlow(
  preflightFn: (
    graph: GraphData,
    pixelCount: number,
    durationSec: number,
    fps: number,
    graphError: string | null,
    seamlessLoop: boolean,
    loopPeriodSec: number | null
  ) => ExportPreflightResult
): ExportBakeFlow {
  const [durationSec, setDurationSec] = useState(30)
  const [fps, setFps] = useState(DEFAULT_TARGET_FPS)
  const [seamlessLoop, setSeamlessLoop] = useState(true)
  const [periodMode, setPeriodMode] = useState<'auto' | 'manual'>('auto')
  const [manualPeriodSec, setManualPeriodSec] = useState(2)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const graph = useMemo(
    () => useGraphStore.getState().toGraphData(),
    [nodes, edges]
  )
  const pixelCount = usePatchStore((s) => s.points.length)
  const graphError = useEngineStore((s) => s.status.graphError)
  const bake = useEngineStore((s) => s.bake)

  const detectedPeriod = useMemo(() => detectLoopPeriod(graph), [graph])
  const loopBake = useMemo(
    () => resolveLoopBakeDuration(durationSec, seamlessLoop, periodMode, manualPeriodSec, graph),
    [durationSec, seamlessLoop, periodMode, manualPeriodSec, graph]
  )
  const preflight = useMemo(
    () =>
      preflightFn(
        graph,
        pixelCount,
        loopBake.bakeDurationSec,
        fps,
        graphError,
        seamlessLoop,
        loopBake.periodSec
      ),
    [preflightFn, graph, pixelCount, loopBake.bakeDurationSec, fps, graphError, seamlessLoop, loopBake.periodSec]
  )

  const activePeriodSec =
    periodMode === 'manual' ? (manualPeriodSec > 0 ? manualPeriodSec : null) : detectedPeriod.periodSec

  const runBake = async (): Promise<BakeResult | null> => {
    if (!preflight.canExport || busy) return null
    setBusy(true)
    setStatus('Baking frames…')
    try {
      const durationMs = Math.max(1, loopBake.bakeDurationSec) * 1000
      const bakeResult = await bake(durationMs, fps)
      if (bakeResult.error !== null) {
        alert(`Bake failed: ${bakeResult.error}`)
        return null
      }

      const seam = measureLoopSeam(
        bakeResult.frames,
        bakeResult.frameCount,
        bakeResult.pixelCount,
        bakeResult.seamFrame
      )
      const seamLabel = formatLoopSeam(seam)
      if (seamlessLoop && seam.matchPercent < seamWarningThreshold()) {
        const proceed = window.confirm(
          `${seamLabel}\n\nThe loop point does not closely match the first frame — playback may jump when it wraps.\n\nExport anyway?`
        )
        if (!proceed) return null
      }

      return {
        frames: bakeResult.frames,
        frameCount: bakeResult.frameCount,
        pixelCount: bakeResult.pixelCount,
        fps: bakeResult.fps,
        seamFrame: bakeResult.seamFrame
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  return {
    durationSec,
    setDurationSec,
    fps,
    setFps,
    seamlessLoop,
    setSeamlessLoop,
    periodMode,
    setPeriodMode,
    manualPeriodSec,
    setManualPeriodSec,
    busy,
    status,
    setStatus,
    graph,
    pixelCount,
    detectedPeriod,
    loopBake,
    activePeriodSec,
    preflight,
    runBake
  }
}

export { formatLoopPeriodSec, formatLoopSeam }
