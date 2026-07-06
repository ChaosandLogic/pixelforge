import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { scopeAxisPosition, type GeneratorScope } from '../shared/graph/generatorScope'
import { buildLayoutPoints, type LayoutData } from '../shared/patch/layout'

function normalisePositions(raw: Float32Array, count: number): Float32Array {
  const out = new Float32Array(count * 3)
  for (let axis = 0; axis < 3; axis++) {
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < count; i++) {
      const v = raw[i * 3 + axis] ?? 0
      if (v < min) min = v
      if (v > max) max = v
    }
    const range = max - min
    for (let i = 0; i < count; i++) {
      out[i * 3 + axis] = range > 0 ? ((raw[i * 3 + axis] ?? 0) - min) / range : 0.5
    }
  }
  return out
}

describe('scopeAxisPosition', () => {
  it('uses physical layout for fixture-scoped x axis (serpentine matrix)', () => {
    const layout: LayoutData = {
      fixtures: [
        {
          id: 'm1',
          name: 'Matrix',
          def: {
            kind: 'matrix',
            cols: 4,
            rows: 2,
            spacingX: 1,
            spacingY: 1,
            origin: { x: 0, y: 0, z: 0 },
            serpentine: true,
            startCorner: 'tl',
            orientation: 'rows'
          }
        }
      ]
    }
    const { points } = buildLayoutPoints(layout)
    const raw = new Float32Array(points.length * 3)
    for (let i = 0; i < points.length; i++) {
      raw[i * 3] = points[i]?.x ?? 0
      raw[i * 3 + 1] = points[i]?.y ?? 0
      raw[i * 3 + 2] = points[i]?.z ?? 0
    }
    const positions = normalisePositions(raw, points.length)

    const scope: GeneratorScope = {
      indices: points.map((_, i) => i),
      resolution: { width: 4, height: 2 },
      fullPatch: false,
      count: points.length
    }

    const xs = Array.from({ length: scope.count }, (_, i) =>
      scopeAxisPosition(positions, i, scope, 'x')
    )

    // Row 0 left-to-right: x should increase
    assert.ok(xs[0] as number < (xs[1] as number))
    assert.ok(xs[1] as number < (xs[2] as number))
    assert.ok(xs[2] as number < (xs[3] as number))
    // Row 1 right-to-left in wiring order, but x still increases left-to-right physically
    assert.ok(xs[4] as number > (xs[5] as number))
    assert.ok(xs[5] as number > (xs[6] as number))
    assert.ok(xs[6] as number > (xs[7] as number))
    // Same column across rows shares the same x position
    assert.equal(xs[0], xs[7])
    assert.equal(xs[1], xs[6])
    assert.equal(xs[2], xs[5])
    assert.equal(xs[3], xs[4])
  })
})
