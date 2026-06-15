import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { listNodeTypes } from '@shared/graph/registry'
import { INTERNAL_NODE_TYPES } from '@shared/graph/nodes'
import type { NodeCategory, NodeTypeDef } from '@shared/graph/types'
import { useGraphStore } from '@/store/graphStore'

const CATEGORY_ORDER: NodeCategory[] = [
  'setup',
  'generator',
  'transform',
  'composite',
  'colour',
  'time',
  'sequence',
  'audio',
  'spatial',
  'logic',
  'math',
  'output'
]

const CATEGORY_LABELS: Record<NodeCategory, string> = {
  setup: 'Setup',
  generator: 'Generators',
  transform: 'Transforms',
  composite: 'Compositing',
  colour: 'Colour',
  time: 'Time & input',
  sequence: 'Sequence',
  audio: 'Audio',
  spatial: 'Spatial',
  logic: 'Logic',
  math: 'Math',
  output: 'Output'
}

function paletteNodes(componentEditId: string | null): NodeTypeDef[] {
  return listNodeTypes().filter((def) => {
    if (INTERNAL_NODE_TYPES.has(def.type) && componentEditId === null) return false
    if (def.type === 'setup/component') return false
    if (def.type === 'output/pixel' && componentEditId !== null) return false
    return true
  })
}

function matchesSearch(def: NodeTypeDef, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  const category = CATEGORY_LABELS[def.category] ?? def.category
  return (
    def.label.toLowerCase().includes(q) ||
    def.description.toLowerCase().includes(q) ||
    def.type.toLowerCase().includes(q) ||
    category.toLowerCase().includes(q)
  )
}

function groupByCategory(defs: NodeTypeDef[]): Array<[NodeCategory, NodeTypeDef[]]> {
  const byCategory = new Map<NodeCategory, NodeTypeDef[]>()
  for (const def of defs) {
    const list = byCategory.get(def.category)
    if (list === undefined) byCategory.set(def.category, [def])
    else list.push(def)
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.label.localeCompare(b.label))
  }
  return CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => [
    cat,
    byCategory.get(cat) as NodeTypeDef[]
  ])
}

export function AddNodeMenu(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const addNode = useGraphStore((s) => s.addNode)
  const componentEditId = useGraphStore((s) => s.componentEditId)
  const { screenToFlowPosition } = useReactFlow()

  const allNodes = useMemo(() => paletteNodes(componentEditId), [componentEditId])
  const filtered = useMemo(
    () => allNodes.filter((def) => matchesSearch(def, query)),
    [allNodes, query]
  )
  const grouped = useMemo(() => groupByCategory(filtered), [filtered])
  const searching = query.trim() !== ''

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const onPointerDown = (e: MouseEvent): void => {
      if (menuRef.current !== null && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const add = (type: string): void => {
    const centre = screenToFlowPosition({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: window.innerHeight / 2 + (Math.random() - 0.5) * 80
    })
    addNode(type, centre)
    setOpen(false)
    setQuery('')
  }

  const toggleOpen = (): void => {
    setOpen((was) => {
      if (was) setQuery('')
      return !was
    })
  }

  return (
    <div className="add-node-menu" ref={menuRef}>
      <button className="add-node-btn" onClick={toggleOpen}>
        + Add node
      </button>
      {open && (
        <div className="add-node-panel">
          <div className="add-node-search-wrap">
            <input
              ref={searchRef}
              className="add-node-search"
              type="search"
              placeholder="Search nodes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="add-node-list">
            {filtered.length === 0 ? (
              <p className="add-node-empty">No nodes match &ldquo;{query.trim()}&rdquo;</p>
            ) : searching ? (
              <div className="add-node-results">
                {filtered
                  .slice()
                  .sort((a, b) => a.label.localeCompare(b.label))
                  .map((def) => (
                    <button
                      key={def.type}
                      className="add-node-item add-node-item--search"
                      onClick={() => add(def.type)}
                      title={def.description}
                    >
                      <span className="add-node-item-label">{def.label}</span>
                      <span className="add-node-item-meta">{CATEGORY_LABELS[def.category]}</span>
                    </button>
                  ))}
              </div>
            ) : (
              grouped.map(([category, defs]) => (
                <section key={category} className="add-node-section">
                  <h3 className="add-node-category">{CATEGORY_LABELS[category]}</h3>
                  <div className="add-node-items">
                    {defs.map((def) => (
                      <button
                        key={def.type}
                        className="add-node-item"
                        onClick={() => add(def.type)}
                        title={def.description}
                      >
                        {def.label}
                      </button>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
