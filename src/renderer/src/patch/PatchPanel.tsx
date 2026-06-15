import { useState } from 'react'
import { deriveAddress, universeCountFor } from '@shared/patch/types'
import { useEngineStore } from '@/store/engineStore'
import { usePatchStore } from '@/store/patchStore'
import { LayoutBuilder } from './LayoutBuilder'

const TABLE_LIMIT = 200

export function PatchPanel(): React.JSX.Element {
  const points = usePatchStore((s) => s.points)
  const layout = usePatchStore((s) => s.layout)
  const resolution = usePatchStore((s) => s.resolution)
  const source = usePatchStore((s) => s.source)
  const lastError = usePatchStore((s) => s.lastError)
  const importFile = usePatchStore((s) => s.importFile)
  const exportCsv = usePatchStore((s) => s.exportCsv)
  const startUniverse = useEngineStore((s) => s.config.startUniverse)
  const [showTable, setShowTable] = useState(false)
  const [showBuilder, setShowBuilder] = useState(false)

  const universes = universeCountFor(points.length)

  return (
    <section className="patch-panel">
      <div className="panel-header">
        <h2>Patch</h2>
      </div>

      <p className="panel-hint">
        {points.length} points · {resolution.width}×{resolution.height} res → {universes} universe
        {universes === 1 ? '' : 's'} (U{startUniverse}
        {universes > 1 ? `–U${startUniverse + universes - 1}` : ''})
      </p>
      <p className="patch-source" title={source}>
        {source}
      </p>

      {layout !== null && (
        <p className="patch-fixture-summary">
          {layout.fixtures.length} fixture{layout.fixtures.length === 1 ? '' : 's'}:{' '}
          {layout.fixtures.map((f) => f.name).join(' → ')}
        </p>
      )}

      <button className="tool-btn layout-builder-btn" onClick={() => setShowBuilder(true)}>
        Layout builder
      </button>

      <div className="patch-actions">
        <button className="tool-btn" onClick={() => void importFile()} title="Import CSV or JSON point cloud">
          Import
        </button>
        <button className="tool-btn" onClick={() => void exportCsv()} title="Export patch as CSV">
          Export
        </button>
      </div>

      {lastError !== null && <p className="patch-error">{lastError}</p>}

      <button className="patch-table-toggle" onClick={() => setShowTable(!showTable)}>
        {showTable ? 'Hide points' : 'Show points'}
      </button>

      {showTable && (
        <div className="patch-table">
          <table>
            <thead>
              <tr>
                <th>id</th>
                <th>x</th>
                <th>y</th>
                <th>z</th>
                <th>addr</th>
              </tr>
            </thead>
            <tbody>
              {points.slice(0, TABLE_LIMIT).map((p, i) => {
                const addr = deriveAddress(i, startUniverse)
                return (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.x.toFixed(2)}</td>
                    <td>{p.y.toFixed(2)}</td>
                    <td>{p.z.toFixed(2)}</td>
                    <td>
                      {addr.universe}:{addr.channel}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {points.length > TABLE_LIMIT && (
            <p className="panel-hint">… and {points.length - TABLE_LIMIT} more</p>
          )}
        </div>
      )}

      {showBuilder && <LayoutBuilder onClose={() => setShowBuilder(false)} />}
    </section>
  )
}
