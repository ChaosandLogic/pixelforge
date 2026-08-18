import { getNodeType } from '@shared/graph/registry'
import { useEngineStore } from '@/store/engineStore'
import { useGraphStore } from '@/store/graphStore'

function formatUniverses(
  protocol: string,
  startUniverse: number,
  universeCount: number
): string {
  if (protocol === 'ddp') return 'DDP stream'
  if (universeCount <= 1) return `U${startUniverse}`
  return `U${startUniverse}–U${startUniverse + universeCount - 1}`
}

export function OutputDiagnosticsPanel(): React.JSX.Element {
  const status = useEngineStore((s) => s.status)
  const nodes = useGraphStore((s) => s.nodes)

  const routeErrors = Object.entries(status.outputErrors).filter(([, err]) => err !== null)
  const perUniversePkt =
    status.outputActive && status.universeCount > 0
      ? Math.round(status.packetsPerSec / status.universeCount)
      : null

  const errorLabel = (nodeId: string): string => {
    const node = nodes.find((n) => n.id === nodeId)
    if (node === undefined) return nodeId
    const def = getNodeType(node.data.nodeType)
    return def?.label ?? node.data.nodeType
  }

  const hasErrors = status.outputError !== null || routeErrors.length > 0 || status.graphError !== null

  return (
    <aside className="diagnostics-panel">
      <div className="panel-header">
        <h2>Output</h2>
        <span className={`diag-status ${status.outputActive ? 'live' : 'idle'}`}>
          <span className={`status-dot ${status.outputActive ? 'on' : 'off'}`} />
          {status.outputActive ? 'Live' : 'Stopped'}
        </span>
      </div>

      <div className="diag-grid">
        <div className="diag-stat">
          <span className="diag-stat-label">Protocol</span>
          <span className="diag-stat-value">{status.outputProtocolName}</span>
        </div>
        <div className="diag-stat">
          <span className="diag-stat-label">Packets/s</span>
          <span className="diag-stat-value">{status.packetsPerSec}</span>
        </div>
        <div className="diag-stat">
          <span className="diag-stat-label">Universes</span>
          <span className="diag-stat-value">
            {formatUniverses(status.outputProtocol, status.startUniverse, status.universeCount)}
          </span>
        </div>
        <div className="diag-stat">
          <span className="diag-stat-label">Pixels</span>
          <span className="diag-stat-value">
            {status.pixelCount.toLocaleString()} {status.colorMode === 'rgbw' ? 'RGBW' : 'RGB'}
          </span>
        </div>
        {status.outputCount > 1 && (
          <div className="diag-stat">
            <span className="diag-stat-label">Routes</span>
            <span className="diag-stat-value">{status.outputCount}</span>
          </div>
        )}
        {perUniversePkt !== null && status.outputProtocol !== 'ddp' && (
          <div className="diag-stat">
            <span className="diag-stat-label">Pkt / universe</span>
            <span className="diag-stat-value">{perUniversePkt}</span>
          </div>
        )}
      </div>

      {hasErrors && (
        <div className="diag-alerts">
          {status.graphError !== null && (
            <p className="diag-alert">
              <span className="diag-alert-label">Graph</span>
              {status.graphError}
            </p>
          )}
          {status.outputError !== null && (
            <p className="diag-alert">
              <span className="diag-alert-label">Output</span>
              {status.outputError}
            </p>
          )}
          {routeErrors.map(([id, err]) => (
            <p key={id} className="diag-alert">
              <span className="diag-alert-label">{errorLabel(id)}</span>
              {err}
            </p>
          ))}
        </div>
      )}
    </aside>
  )
}
