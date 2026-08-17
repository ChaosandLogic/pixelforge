import { create } from 'zustand'
import {
  buildLayoutPoints,
  createDefaultLayout,
  createFixture,
  fixtureRanges,
  translateFixtureDef,
  type Fixture,
  type FixtureDef,
  type FixtureKind,
  type LayoutData,
  type Vec3
} from '@shared/patch/layout'
import { MAX_PIXELS } from '@shared/messages'
import { pointsToPositions, type PatchPoint } from '@shared/patch/types'
import { inferResolutionFromLayout, type Resolution } from '@shared/spatial/resolution'
import { engineBridge, onEngineConnect } from '@/engine/bridge'

interface PatchState {
  points: PatchPoint[]
  layout: LayoutData | null
  resolution: Resolution
  layoutOverflow: boolean
  /** Source description for the UI ("layout builder", file name...) */
  source: string
  lastError: string | null

  setPoints: (points: PatchPoint[], source: string) => void
  loadPatch: (points: PatchPoint[], layout: LayoutData | null | undefined, source: string) => void
  addFixture: (kind: FixtureKind) => string
  updateFixture: (id: string, patch: Partial<Pick<Fixture, 'name' | 'def'>>) => void
  translateFixtures: (ids: string[], delta: Vec3) => void
  removeFixture: (id: string) => void
  moveFixture: (id: string, dir: -1 | 1) => void
  duplicateFixture: (id: string) => void
  importFile: () => Promise<void>
  exportCsv: () => Promise<void>
  resetToDefault: () => void
}

function syncToEngine(points: PatchPoint[], resolution: Resolution, layout: LayoutData | null): void {
  engineBridge.send({
    type: 'set-patch',
    positions: pointsToPositions(points),
    count: points.length,
    resolutionWidth: resolution.width,
    resolutionHeight: resolution.height,
    fixtureRanges: layout !== null ? fixtureRanges(layout) : []
  })
}

function rebuildFromLayout(layout: LayoutData): { points: PatchPoint[]; overflow: boolean } {
  const { points, overflow } = buildLayoutPoints(layout)
  return { points, overflow }
}

function layoutSource(layout: LayoutData): string {
  const parts = layout.fixtures.map((f) => `${f.name} (${f.def.kind})`)
  return `layout: ${parts.join(' → ')}`
}

// --- parsers -----------------------------------------------------------------

function parseCsvPatch(content: string): PatchPoint[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'))
  if (lines.length === 0) throw new Error('File is empty')

  const first = (lines[0] as string).split(',').map((c) => c.trim().toLowerCase())
  const hasHeader = first.some((c) => Number.isNaN(Number(c)) && c !== '')
  let cols = { x: 0, y: 1, z: 2, id: -1 }
  let startRow = 0
  if (hasHeader) {
    const idx = (name: string): number => first.indexOf(name)
    if (idx('x') === -1 || idx('y') === -1) throw new Error('CSV header must include x and y columns')
    cols = { x: idx('x'), y: idx('y'), z: idx('z'), id: idx('id') }
    startRow = 1
  }

  const points: PatchPoint[] = []
  for (let row = startRow; row < lines.length; row++) {
    const cells = (lines[row] as string).split(',').map((c) => c.trim())
    const x = Number(cells[cols.x])
    const y = Number(cells[cols.y])
    const z = cols.z >= 0 ? Number(cells[cols.z] ?? 0) : 0
    if (Number.isNaN(x) || Number.isNaN(y)) {
      throw new Error(`Row ${row + 1}: invalid coordinates`)
    }
    const id = cols.id >= 0 && cells[cols.id] !== undefined && cells[cols.id] !== '' ? (cells[cols.id] as string) : `p${points.length}`
    points.push({ id, x, y, z: Number.isNaN(z) ? 0 : z })
  }
  if (points.length === 0) throw new Error('No points found')
  return points
}

function parseJsonPatch(content: string): PatchPoint[] {
  const raw: unknown = JSON.parse(content)
  const list = Array.isArray(raw) ? raw : typeof raw === 'object' && raw !== null ? (raw as { points?: unknown }).points : undefined
  if (!Array.isArray(list)) throw new Error('Expected an array of points or { points: [...] }')

  const points: PatchPoint[] = []
  for (const item of list) {
    if (Array.isArray(item)) {
      const [x, y, z] = item as number[]
      if (typeof x !== 'number' || typeof y !== 'number') throw new Error('Point arrays must be [x, y, z]')
      points.push({ id: `p${points.length}`, x, y, z: typeof z === 'number' ? z : 0 })
    } else if (typeof item === 'object' && item !== null) {
      const p = item as { id?: unknown; x?: unknown; y?: unknown; z?: unknown }
      if (typeof p.x !== 'number' || typeof p.y !== 'number') throw new Error('Points must have numeric x and y')
      points.push({
        id: typeof p.id === 'string' ? p.id : `p${points.length}`,
        x: p.x,
        y: p.y,
        z: typeof p.z === 'number' ? p.z : 0
      })
    }
  }
  if (points.length === 0) throw new Error('No points found')
  return points
}

// --- store -------------------------------------------------------------------

export const usePatchStore = create<PatchState>((set, get) => {
  const initialLayout = createDefaultLayout()
  const initialBuild = rebuildFromLayout(initialLayout)
  const initialResolution = inferResolutionFromLayout(initialLayout, initialBuild.points.length)
  queueMicrotask(() => syncToEngine(initialBuild.points, initialResolution, initialLayout))

  onEngineConnect(() => {
    const { points, resolution, layout } = get()
    syncToEngine(points, resolution, layout)
  })

  const applyLayout = (layout: LayoutData): void => {
    const { points, overflow } = rebuildFromLayout(layout)
    const resolution = inferResolutionFromLayout(layout, points.length)
    set({
      layout,
      points,
      resolution,
      layoutOverflow: overflow,
      source: layoutSource(layout),
      lastError: overflow ? `Layout exceeds ${MAX_PIXELS} points and was truncated` : null
    })
    syncToEngine(points, resolution, layout)
  }

  return {
    points: initialBuild.points,
    layout: initialLayout,
    resolution: initialResolution,
    layoutOverflow: initialBuild.overflow,
    source: layoutSource(initialLayout),
    lastError: null,

    setPoints: (points, source) => {
      const resolution = inferResolutionFromLayout(null, points.length)
      set({ points, source, layout: null, resolution, layoutOverflow: false, lastError: null })
      syncToEngine(points, resolution, null)
    },

    loadPatch: (points, layout, source) => {
      if (layout !== null && layout !== undefined && layout.fixtures.length > 0) {
        applyLayout(layout)
        set({ source })
      } else {
        const resolution = inferResolutionFromLayout(null, points.length)
        set({ points, layout: layout ?? null, source, resolution, layoutOverflow: false, lastError: null })
        syncToEngine(points, resolution, layout ?? null)
      }
    },

    addFixture: (kind) => {
      const layout = get().layout ?? { fixtures: [] }
      const fixture = createFixture(kind)
      const next: LayoutData = { fixtures: [...layout.fixtures, fixture] }
      applyLayout(next)
      return fixture.id
    },

    updateFixture: (id, patch) => {
      const layout = get().layout
      if (layout === null) return
      const next: LayoutData = {
        fixtures: layout.fixtures.map((f) => (f.id === id ? { ...f, ...patch, def: patch.def ?? f.def } : f))
      }
      applyLayout(next)
    },

    translateFixtures: (ids, delta) => {
      const layout = get().layout
      if (layout === null || ids.length === 0) return
      const idSet = new Set(ids)
      const fixtures = layout.fixtures.map((f) =>
        idSet.has(f.id) ? { ...f, def: translateFixtureDef(f.def, delta) } : f
      )
      applyLayout({ fixtures })
    },

    removeFixture: (id) => {
      const layout = get().layout
      if (layout === null || layout.fixtures.length <= 1) return
      applyLayout({ fixtures: layout.fixtures.filter((f) => f.id !== id) })
    },

    moveFixture: (id, dir) => {
      const layout = get().layout
      if (layout === null) return
      const idx = layout.fixtures.findIndex((f) => f.id === id)
      if (idx < 0) return
      const target = idx + dir
      if (target < 0 || target >= layout.fixtures.length) return
      const fixtures = [...layout.fixtures]
      const tmp = fixtures[idx] as Fixture
      fixtures[idx] = fixtures[target] as Fixture
      fixtures[target] = tmp
      applyLayout({ fixtures })
    },

    duplicateFixture: (id) => {
      const layout = get().layout
      if (layout === null) return
      const src = layout.fixtures.find((f) => f.id === id)
      if (src === undefined) return
      const copy = createFixture(src.def.kind, `${src.name} copy`)
      copy.def = structuredClone(src.def) as FixtureDef
      const idx = layout.fixtures.findIndex((f) => f.id === id)
      const fixtures = [...layout.fixtures]
      fixtures.splice(idx + 1, 0, copy)
      applyLayout({ fixtures })
    },

    importFile: async () => {
      try {
        const file = await window.pixelforge.openTextFile(['csv', 'json', 'txt'])
        if (file === null) return
        const points = file.name.toLowerCase().endsWith('.json')
          ? parseJsonPatch(file.content)
          : parseCsvPatch(file.content)
        get().setPoints(points, file.name)
      } catch (err) {
        set({ lastError: err instanceof Error ? err.message : String(err) })
      }
    },

    exportCsv: async () => {
      const { points } = get()
      const lines = ['id,x,y,z', ...points.map((p) => `${p.id},${p.x},${p.y},${p.z}`)]
      await window.pixelforge.saveTextFile(lines.join('\n'), 'patch.csv')
    },

    resetToDefault: () => {
      applyLayout(createDefaultLayout())
    }
  }
})
