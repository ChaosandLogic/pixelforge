import { useEngineStore } from '@/store/engineStore'
import { useUiStore } from '@/store/uiStore'

export function formatEvalMs(ms: number): string {
  if (ms < 0.05) return '<0.1ms'
  if (ms < 10) return `${ms.toFixed(1)}ms`
  return `${ms.toFixed(0)}ms`
}

export function NodeProfilerBadge({ nodeId }: { nodeId: string }): React.JSX.Element | null {
  const enabled = useUiStore((s) => s.profilerEnabled)
  const ms = useEngineStore((s) => s.nodeTimings[nodeId])

  if (!enabled || ms === undefined) return null

  const className = ms >= 2 ? 'pf-profiler hot' : ms >= 0.5 ? 'pf-profiler warm' : 'pf-profiler'

  return (
    <span className={className} title="Evaluate time this frame">
      {formatEvalMs(ms)}
    </span>
  )
}
