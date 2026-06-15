import { firstFixtureId, fixtureRangeById, indicesForFixture } from '../../../patch/fixtureRoute'
import type { Resolution } from '../../../spatial/resolution'
import { pixelsInput, stringParam, type NodeTypeDef } from '../../types'

export const FIXTURE_NODE_TYPE = 'setup/fixture'

/** Params edited on the node card. */
export const FIXTURE_INLINE_PARAMS = new Set(['fixtureId'])

/**
 * Fixture scope at the start of a chain: leave pixels unconnected to emit a
 * compact stream + resolution (with indices) for downstream generators.
 *
 * Fixture at the end of a chain: wire pixels in to map a stream onto one
 * layout fixture in the full patch. Merge several Fixture nodes with Add/Mix
 * before Pixel Output.
 */
export const Fixture: NodeTypeDef = {
  type: FIXTURE_NODE_TYPE,
  label: 'Fixture',
  category: 'setup',
  description: 'Fixture scope for generators, or maps a stream onto one fixture',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [
    { name: 'pixels', label: 'Pixels', type: 'pixels' },
    { name: 'resolution', label: 'Resolution', type: 'resolution' }
  ],
  params: [{ name: 'fixtureId', label: 'Fixture', type: 'string', default: '' }],
  evaluate(inputs, params, ctx) {
    const src = pixelsInput(inputs, 'pixels')
    const ranges = ctx.fixtureRanges
    let fixtureId = stringParam(params, 'fixtureId', '')
    if (fixtureId === '') fixtureId = firstFixtureId(ranges)

    const range = fixtureRangeById(fixtureId, ranges)
    const res: Resolution = {
      width: range?.width ?? ctx.resolution.width,
      height: range?.height ?? ctx.resolution.height
    }

    if (src === null) {
      if (range === undefined || range.count <= 0) {
        const out = ctx.acquire()
        out.fill(0)
        return { pixels: out, resolution: res }
      }
      const indices = indicesForFixture(fixtureId, ranges)
      const compact = new Float32Array(indices.length * 3)
      return {
        pixels: compact,
        resolution: { ...res, indices }
      }
    }

    const out = ctx.acquire()
    out.fill(0)
    if (range === undefined || range.count <= 0) {
      return { pixels: out, resolution: res }
    }

    const indices = indicesForFixture(fixtureId, ranges)
    const fullLen = ctx.pixelCount * 3
    const isFullPatch = src.length >= fullLen

    for (let i = 0; i < indices.length; i++) {
      const g = indices[i] as number
      const dst = g * 3
      const srcOff = isFullPatch ? dst : i * 3
      if (srcOff + 2 >= src.length) continue
      out[dst] = src[srcOff] as number
      out[dst + 1] = src[srcOff + 1] as number
      out[dst + 2] = src[srcOff + 2] as number
    }

    return { pixels: out, resolution: res }
  }
}
