import type { FixtureRange } from './layout'

/** Global patch indices for one fixture (in wiring order). */
export function indicesForFixture(fixtureId: string, ranges: FixtureRange[]): number[] {
  if (fixtureId === '') return []
  const range = ranges.find((r) => r.id === fixtureId)
  if (range === undefined) return []
  const indices: number[] = []
  for (let i = 0; i < range.count; i++) indices.push(range.start + i)
  return indices
}

export function firstFixtureId(ranges: FixtureRange[]): string {
  return ranges[0]?.id ?? ''
}

export function fixtureRangeById(fixtureId: string, ranges: FixtureRange[]): FixtureRange | undefined {
  return ranges.find((r) => r.id === fixtureId)
}
