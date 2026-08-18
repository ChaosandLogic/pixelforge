import { useState } from 'react'
import { OUTPUT_NODE_TYPE } from '@shared/graph/nodes/output/PixelOutput'
import { DEFAULT_OUTPUT_DRIVER, parseOutputDriver } from '@shared/output/config'
import { COLOR_MODE_LABELS } from '@shared/output/rgbw'
import { deriveAddress, universeCountFor } from '@shared/patch/types'
import { useGraphStore } from '@/store/graphStore'
import { usePatchStore } from '@/store/patchStore'
import { LayoutBuilder } from './LayoutBuilder'

const TABLE_LIMIT = 200

export function PatchDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element | null {
  const points = usePatchStore((s) => s.points)
  const layout = usePatchStore((s) => s.layout)
  const resolution = usePatchStore((s) => s.resolution)
  const source = usePatchStore((s) => s.source)
  const lastError = usePatchStore((s) => s.lastError)
  const importFile = usePatchStore((s) => s.importFile)
  const exportCsv = usePatchStore((s) => s.exportCsv)
  const outputParams = useGraphStore((s) => {
    const node = s.nodes.find((n) => n.data.nodeType === OUTPUT_NODE_TYPE)
    return node?.data.params
  })
  const outputDriver =
    outputParams === undefined
      ? DEFAULT_OUTPUT_DRIVER
      : parseOutputDriver(outputParams as Record<string, unknown>)
  const startUniverse = outputDriver.startUniverse
  const colorMode = outputDriver.colorMode
  const [showTable, setShowTable] = useState(false)
  const [showBuilder, setShowBuilder] = useState(false)

  const universes = universeCountFor(points.length, colorMode)

  if (!open && !showBuilder) return null

  return (
    <>
      {open && (
        <div className="patch-dialog-overlay" onClick={onClose}>
          <div
            className="patch-dialog"
            role="dialog"
            aria-labelledby="patch-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="layout-builder-header">
              <h2 id="patch-dialog-title">Patch</h2>
              <button type="button" className="layout-close-btn" onClick={onClose} title="Close">
                ×
              </button>
            </div>

            <div className="patch-dialog-body">
              <p className="panel-hint">
                {points.length} points · {resolution.width}×{resolution.height} res · {COLOR_MODE_LABELS[colorMode]} →{' '}
                {universes} universe
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
                <button
                  className="tool-btn"
                  onClick={() => void importFile()}
                  title="Import CSV or JSON point cloud"
                >
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
                        const addr = deriveAddress(i, startUniverse, colorMode)
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
            </div>
          </div>
        </div>
      )}

      {showBuilder && <LayoutBuilder onClose={() => setShowBuilder(false)} />}
    </>
  )
}
