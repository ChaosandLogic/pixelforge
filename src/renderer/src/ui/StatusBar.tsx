import { Fragment } from 'react'
import { getNodeType } from '@shared/graph/registry'
import { formatEvalMs } from '@/graph/components/NodeProfilerBadge'
import { useEngineStore } from '@/store/engineStore'
import { useGraphStore } from '@/store/graphStore'
import { useUiStore } from '@/store/uiStore'

export function StatusBar(): React.JSX.Element {
  const status = useEngineStore((s) => s.status)
  const nodes = useGraphStore((s) => s.nodes)
  const profilerEnabled = useUiStore((s) => s.profilerEnabled)
  const evalMs = useEngineStore((s) =>
    profilerEnabled ? Object.values(s.nodeTimings).reduce((sum, ms) => sum + ms, 0) : 0
  )

  const routeErrors = Object.entries(status.outputErrors).filter(
    (entry): entry is [string, string] => entry[1] !== null
  )
  const routeErrorMessages = new Set(routeErrors.map(([, err]) => err))

  const routeLabel = (nodeId: string): string => {
    const node = nodes.find((n) => n.id === nodeId)
    if (node === undefined) return nodeId
    return getNodeType(node.data.nodeType)?.label ?? node.data.nodeType
  }

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
      <span className="status-item">
        {status.pixelCount} pixels · {status.colorMode === 'rgbw' ? 'RGBW' : 'RGB'}
      </span>
      {status.outputError !== null && !routeErrorMessages.has(status.outputError) && (
        <>
          <span className="status-sep" />
          <span className="status-item error" title={status.outputError}>
            {status.outputError}
          </span>
        </>
      )}
      {routeErrors.map(([id, err]) => (
        <Fragment key={id}>
          <span className="status-sep" />
          <span className="status-item error" title={err}>
            {routeLabel(id)}: {err}
          </span>
        </Fragment>
      ))}
      {status.graphError !== null && (
        <>
          <span className="status-sep" />
          <span className="status-item error" title={status.graphError}>
            {status.graphError}
          </span>
        </>
      )}
    </footer>
  )
}
