import { useEffect, useState } from 'react'
import {
  fixturePointCount,
  matrixSpacing,
  type Fixture,
  type FixtureDef,
  type FixtureKind,
  type MatrixOrientation,
  type StartCorner,
  type Vec3
} from '@shared/patch/layout'
import { MAX_PIXELS } from '@shared/messages'
import { universeCountFor } from '@shared/patch/types'
import { useEngineStore } from '@/store/engineStore'
import { usePatchStore } from '@/store/patchStore'
import { LayoutPreview } from './LayoutPreview'

const FIXTURE_KINDS: Array<{ kind: FixtureKind; label: string }> = [
  { kind: 'line', label: 'Line' },
  { kind: 'matrix', label: 'Matrix' },
  { kind: 'ring', label: 'Ring' }
]

function Vec3Fields({
  label,
  value,
  onChange
}: {
  label: string
  value: Vec3
  onChange: (v: Vec3) => void
}): React.JSX.Element {
  const axis = (key: keyof Vec3, axisLabel: string): React.JSX.Element => (
    <label className="vec3-axis">
      <span>{axisLabel}</span>
      <input
        type="number"
        step={0.1}
        value={value[key]}
        onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) || 0 })}
      />
    </label>
  )
  return (
    <div className="param-row vec3-row">
      <label>{label}</label>
      <div className="vec3-fields">
        {axis('x', 'X')}
        {axis('y', 'Y')}
        {axis('z', 'Z')}
      </div>
    </div>
  )
}

function FixtureParams({
  fixture,
  onChange
}: {
  fixture: Fixture
  onChange: (def: FixtureDef) => void
}): React.JSX.Element {
  const def = fixture.def

  switch (def.kind) {
    case 'line':
      return (
        <>
          <div className="param-row">
            <label>Count</label>
            <input
              type="number"
              min={1}
              max={MAX_PIXELS}
              value={def.count}
              onChange={(e) => onChange({ ...def, count: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
          <Vec3Fields label="Start" value={def.start} onChange={(start) => onChange({ ...def, start })} />
          <Vec3Fields label="End" value={def.end} onChange={(end) => onChange({ ...def, end })} />
          <div className="param-row">
            <label>Start at end</label>
            <input
              type="checkbox"
              checked={def.reversed === true}
              onChange={(e) => onChange({ ...def, reversed: e.target.checked })}
            />
          </div>
        </>
      )
    case 'matrix': {
      const { spacingX, spacingY } = matrixSpacing(def)
      return (
        <>
          <div className="param-row">
            <label>Columns</label>
            <input
              type="number"
              min={1}
              max={512}
              value={def.cols}
              onChange={(e) => onChange({ ...def, cols: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
          <div className="param-row">
            <label>Rows</label>
            <input
              type="number"
              min={1}
              max={512}
              value={def.rows}
              onChange={(e) => onChange({ ...def, rows: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
          <div className="param-row">
            <label>Spacing X</label>
            <input
              type="number"
              min={0.001}
              step={0.1}
              value={spacingX}
              onChange={(e) => onChange({ ...def, spacingX: Math.max(0.001, Number(e.target.value) || 1) })}
            />
          </div>
          <div className="param-row">
            <label>Spacing Y</label>
            <input
              type="number"
              min={0.001}
              step={0.1}
              value={spacingY}
              onChange={(e) => onChange({ ...def, spacingY: Math.max(0.001, Number(e.target.value) || 1) })}
            />
          </div>
          <Vec3Fields label="Origin" value={def.origin} onChange={(origin) => onChange({ ...def, origin })} />
          <div className="param-row">
            <label>Serpentine (zig-zag)</label>
            <input
              type="checkbox"
              checked={def.serpentine}
              onChange={(e) => onChange({ ...def, serpentine: e.target.checked })}
            />
          </div>
          <div className="param-row">
            <label>Start corner</label>
            <select
              value={def.startCorner}
              onChange={(e) => onChange({ ...def, startCorner: e.target.value as StartCorner })}
            >
              <option value="bl">Bottom-left</option>
              <option value="br">Bottom-right</option>
              <option value="tl">Top-left</option>
              <option value="tr">Top-right</option>
            </select>
          </div>
          <div className="param-row">
            <label>Orientation</label>
            <select
              value={def.orientation}
              onChange={(e) => onChange({ ...def, orientation: e.target.value as MatrixOrientation })}
            >
              <option value="rows">Rows (horizontal runs)</option>
              <option value="cols">Columns (vertical runs)</option>
            </select>
          </div>
        </>
      )
    }
    case 'ring':
      return (
        <>
          <div className="param-row">
            <label>Count</label>
            <input
              type="number"
              min={1}
              max={MAX_PIXELS}
              value={def.count}
              onChange={(e) => onChange({ ...def, count: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
          <div className="param-row">
            <label>Radius</label>
            <input
              type="number"
              min={0.01}
              step={0.1}
              value={def.radius}
              onChange={(e) => onChange({ ...def, radius: Math.max(0.01, Number(e.target.value) || 1) })}
            />
          </div>
          <Vec3Fields label="Center" value={def.center} onChange={(center) => onChange({ ...def, center })} />
          <div className="param-row">
            <label>Start angle (rad)</label>
            <input
              type="number"
              step={0.1}
              value={def.startAngle}
              onChange={(e) => onChange({ ...def, startAngle: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="param-row">
            <label>Clockwise</label>
            <input
              type="checkbox"
              checked={def.clockwise}
              onChange={(e) => onChange({ ...def, clockwise: e.target.checked })}
            />
          </div>
        </>
      )
  }
}

export function LayoutBuilder({ onClose }: { onClose: () => void }): React.JSX.Element {
  const layout = usePatchStore((s) => s.layout)
  const points = usePatchStore((s) => s.points)
  const layoutOverflow = usePatchStore((s) => s.layoutOverflow)
  const lastError = usePatchStore((s) => s.lastError)
  const addFixture = usePatchStore((s) => s.addFixture)
  const updateFixture = usePatchStore((s) => s.updateFixture)
  const removeFixture = usePatchStore((s) => s.removeFixture)
  const moveFixture = usePatchStore((s) => s.moveFixture)
  const duplicateFixture = usePatchStore((s) => s.duplicateFixture)
  const startUniverse = useEngineStore((s) => s.config.startUniverse)

  const fixtures = layout?.fixtures ?? []
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    fixtures[0] !== undefined ? [fixtures[0].id] : []
  )
  const [showAddMenu, setShowAddMenu] = useState(false)

  const selected =
    selectedIds.length === 1 ? fixtures.find((f) => f.id === selectedIds[0]) : undefined
  const universes = universeCountFor(points.length)

  useEffect(() => {
    const valid = selectedIds.filter((id) => fixtures.some((f) => f.id === id))
    if (valid.length !== selectedIds.length) {
      setSelectedIds(valid.length > 0 ? valid : fixtures[0] !== undefined ? [fixtures[0].id] : [])
    }
  }, [fixtures, selectedIds])

  const handleAdd = (kind: FixtureKind): void => {
    const id = addFixture(kind)
    setSelectedIds([id])
    setShowAddMenu(false)
  }

  return (
    <div className="layout-builder-overlay" onClick={onClose}>
      <div className="layout-builder" onClick={(e) => e.stopPropagation()}>
        <header className="layout-builder-header">
          <h2>Layout Builder</h2>
          <button className="layout-close-btn" onClick={onClose} title="Close">
            ×
          </button>
        </header>

        <div className="layout-builder-body">
          <div className="layout-builder-left">
            <div className="fixture-list-header">
              <span>Fixtures (wiring order)</span>
              <div className="fixture-add-wrap">
                <button className="tool-btn" onClick={() => setShowAddMenu(!showAddMenu)}>
                  + Add
                </button>
                {showAddMenu && (
                  <div className="fixture-add-menu">
                    {FIXTURE_KINDS.map(({ kind, label }) => (
                      <button key={kind} onClick={() => handleAdd(kind)}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <ul className="fixture-list">
              {fixtures.map((f, i) => (
                <li
                  key={f.id}
                  className={selectedIds.includes(f.id) ? 'fixture-row selected' : 'fixture-row'}
                  onClick={() => setSelectedIds([f.id])}
                >
                  <span className="fixture-order">{i + 1}</span>
                  <div className="fixture-info">
                    <span className="fixture-name">{f.name}</span>
                    <span className="fixture-meta">
                      {f.def.kind} · {fixturePointCount(f.def)} px
                    </span>
                  </div>
                  <div className="fixture-actions" onClick={(e) => e.stopPropagation()}>
                    <button title="Move up" disabled={i === 0} onClick={() => moveFixture(f.id, -1)}>
                      ↑
                    </button>
                    <button title="Move down" disabled={i === fixtures.length - 1} onClick={() => moveFixture(f.id, 1)}>
                      ↓
                    </button>
                    <button title="Duplicate" onClick={() => duplicateFixture(f.id)}>
                      ⧉
                    </button>
                    <button title="Delete" disabled={fixtures.length <= 1} onClick={() => removeFixture(f.id)}>
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {selected !== undefined && (
              <div className="fixture-params">
                <div className="param-row">
                  <label>Name</label>
                  <input
                    type="text"
                    value={selected.name}
                    onChange={(e) => updateFixture(selected.id, { name: e.target.value })}
                  />
                </div>
                <FixtureParams
                  fixture={selected}
                  onChange={(def) => updateFixture(selected.id, { def })}
                />
              </div>
            )}
            {selected === undefined && selectedIds.length > 1 && (
              <p className="panel-hint">{selectedIds.length} fixtures selected — drag to move together</p>
            )}
          </div>

          <div className="layout-builder-right">
            <LayoutPreview
              fixtures={fixtures}
              points={points}
              selectedFixtureIds={selectedIds}
              onSelectFixtures={setSelectedIds}
            />
          </div>
        </div>

        <footer className="layout-builder-footer">
          <span>
            {points.length} points → {universes} universe{universes === 1 ? '' : 's'} (U{startUniverse}
            {universes > 1 ? `–U${startUniverse + universes - 1}` : ''})
          </span>
          {layoutOverflow && (
            <span className="layout-overflow-warn">Truncated at {MAX_PIXELS} points</span>
          )}
          {lastError !== null && layoutOverflow && <span className="patch-error">{lastError}</span>}
        </footer>
      </div>
    </div>
  )
}
