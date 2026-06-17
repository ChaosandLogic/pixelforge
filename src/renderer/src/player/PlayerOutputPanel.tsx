import { OUTPUT_NODE_TYPE } from '@shared/graph/nodes/output/PixelOutput'
import { useGraphStore } from '@/store/graphStore'
import { OutputSettingsForm } from '@/ui/OutputSettingsForm'
import { useShallow } from 'zustand/react/shallow'

export function PlayerOutputPanel(): React.JSX.Element {
  const outputNodes = useGraphStore(
    useShallow((s) => s.nodes.filter((n) => n.data.nodeType === OUTPUT_NODE_TYPE))
  )

  return (
    <aside className="player-output-panel">
      <div className="panel-header">
        <h2>Pixel Output</h2>
      </div>

      {outputNodes.length === 0 ? (
        <p className="panel-hint">No Pixel Output node in this show.</p>
      ) : (
        outputNodes.map((node, index) => (
          <div key={node.id} className="player-output-route">
            {outputNodes.length > 1 && (
              <h3 className="player-output-route-label">Route {index + 1}</h3>
            )}
            <OutputSettingsForm nodeId={node.id} />
          </div>
        ))
      )}
    </aside>
  )
}
