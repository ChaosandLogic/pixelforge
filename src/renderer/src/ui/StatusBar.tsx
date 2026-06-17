import { formatEvalMs } from '@/graph/components/NodeProfilerBadge'
import { useEngineStore } from '@/store/engineStore'
import { useUiStore } from '@/store/uiStore'

export function StatusBar(): React.JSX.Element {
  const status = useEngineStore((s) => s.status)
  const profilerEnabled = useUiStore((s) => s.profilerEnabled)
  const evalMs = useEngineStore((s) =>
    profilerEnabled ? Object.values(s.nodeTimings).reduce((sum, ms) => sum + ms, 0) : 0
  )

  return (
    <footer className="status-bar">
      <span className={status.outputActive ? 'status-dot on' : 'status-dot off'} />
      <span className="status-item">{status.outputActive ? 'Transmitting' : 'Output stopped'}</span>
      <span className="status-sep" />
      <span className="status-item">Engine {status.fps.toFixed(1)} fps</span>
      {profilerEnabled && (
        <>
          <span className="status-sep" />
          <span className="status-item">Eval {formatEvalMs(evalMs)}</span>
        </>
      )}
      <span className="status-sep" />
      <span className="status-item">{status.packetsPerSec} pkt/s</span>
      <span className="status-sep" />
      <span className="status-item">{status.outputProtocolName}</span>
      {status.outputCount > 1 && (
        <>
          <span className="status-sep" />
          <span className="status-item">{status.outputCount} transmitting</span>
        </>
      )}
      <span className="status-sep" />
      <span className="status-item">
        {status.outputProtocol === 'ddp'
          ? 'DDP stream'
          : status.universeCount === 1
            ? `Universe ${status.startUniverse}`
            : `U${status.startUniverse}–U${status.startUniverse + status.universeCount - 1}`}
      </span>
      <span className="status-sep" />
      <span className="status-item">{status.pixelCount} pixels</span>
      {status.outputError !== null && (
        <>
          <span className="status-sep" />
          <span className="status-item error">{status.outputError}</span>
        </>
      )}
      {status.graphError !== null && (
        <>
          <span className="status-sep" />
          <span className="status-item error">{status.graphError}</span>
        </>
      )}
    </footer>
  )
}
