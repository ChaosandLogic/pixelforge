/**
 * Generates example .pxf project files in examples/.
 * Run: npx tsx scripts/build-examples.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProjectFile } from '../src/shared/project'
import { DEFAULT_ENGINE_CONFIG } from '../src/shared/messages'
import {
  buildLayoutPoints,
  createFixture,
  resetFixtureIdCounter,
  type LayoutData
} from '../src/shared/patch/layout'
import type { EdgeData, GraphData, NodeData, ParamValue } from '../src/shared/graph/types'
import { defaultParams } from '../src/shared/graph/types'
import { getNodeType } from '../src/shared/graph/registry'
import { registerStandardNodes } from '../src/shared/graph/nodes'
registerStandardNodes()

const OUT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'examples')

/** Horizontal gap between pipeline stages. */
const DX = 340
/** Vertical gap between parallel branches / sources. */
const DY = 150
/** Left margin for control / fixture columns. */
const M = 80

function col(n: number, x = M): number {
  return x + n * DX
}

function row(n: number, y = M): number {
  return y + n * DY
}

interface PatchSpec {
  name: string
  filename: string
  description: string
  layout: LayoutData
  buildGraph: (layout: LayoutData) => GraphData
}

function params(type: string, overrides: Record<string, ParamValue> = {}): Record<string, ParamValue> {
  const def = getNodeType(type)
  if (def === undefined) throw new Error(`Unknown node type: ${type}`)
  return { ...defaultParams(def), ...overrides }
}

/** Two-stop ramp for generator/gradient (replaces legacy from/to params). */
function gradientStops(
  from: { r: number; g: number; b: number },
  to: { r: number; g: number; b: number }
): ParamValue {
  return [
    { id: 'a', position: 0, colour: from },
    { id: 'b', position: 1, colour: to }
  ]
}

function node(id: string, type: string, x: number, y: number, p: Record<string, ParamValue> = {}, preview = false): NodeData {
  return { id, type, position: { x, y }, params: p, ...(preview ? { preview: true } : {}) }
}

function edge(id: string, from: string, fromPort: string, to: string, toPort: string): EdgeData {
  return { id, fromNode: from, fromPort, toNode: to, toPort }
}

function fid(layout: LayoutData, index: number): string {
  return layout.fixtures[index]?.id ?? ''
}

function lineLayout(count: number): LayoutData {
  resetFixtureIdCounter(0)
  const fixture = createFixture('line', 'Main strip')
  if (fixture.def.kind === 'line') {
    fixture.def.count = count
    fixture.def.start = { x: 0, y: 0.5, z: 0 }
    fixture.def.end = { x: 1, y: 0.5, z: 0 }
  }
  return { fixtures: [fixture] }
}

function matrixLayout(cols: number, rows: number): LayoutData {
  resetFixtureIdCounter(0)
  const fixture = createFixture('matrix', 'LED matrix')
  if (fixture.def.kind === 'matrix') {
    fixture.def.cols = cols
    fixture.def.rows = rows
    fixture.def.spacingX = 1
    fixture.def.spacingY = 1
    fixture.def.origin = { x: 0, y: 0, z: 0 }
    fixture.def.serpentine = true
    fixture.def.startCorner = 'bl'
    fixture.def.orientation = 'rows'
  }
  return { fixtures: [fixture] }
}

function ringLayout(count: number): LayoutData {
  resetFixtureIdCounter(0)
  const fixture = createFixture('ring', 'Ring')
  if (fixture.def.kind === 'ring') {
    fixture.def.count = count
    fixture.def.radius = 1
    fixture.def.center = { x: 0.5, y: 0.5, z: 0 }
    fixture.def.startAngle = 0
    fixture.def.clockwise = true
  }
  return { fixtures: [fixture] }
}

/** Line + ring + matrix — mimics a small venue rig. */
function venueLayout(): LayoutData {
  resetFixtureIdCounter(0)
  const bar = createFixture('line', 'Bar strip')
  if (bar.def.kind === 'line') {
    bar.def.count = 80
    bar.def.start = { x: 0, y: 0.1, z: 0 }
    bar.def.end = { x: 1, y: 0.1, z: 0 }
  }
  const ring = createFixture('ring', 'Centre ring')
  if (ring.def.kind === 'ring') {
    ring.def.count = 48
    ring.def.radius = 0.35
    ring.def.center = { x: 0.5, y: 0.55, z: 0 }
  }
  const wall = createFixture('matrix', 'Back wall')
  if (wall.def.kind === 'matrix') {
    wall.def.cols = 24
    wall.def.rows = 6
    wall.def.spacingX = 1
    wall.def.spacingY = 1
    wall.def.origin = { x: 0, y: 0.75, z: 0 }
    wall.def.serpentine = true
    wall.def.startCorner = 'bl'
  }
  return { fixtures: [bar, ring, wall] }
}

const showSegments = [
  { id: 'intro', duration: 8, transition: { type: 'crossfade' as const, duration: 2, curve: 'ease-in-out' as const } },
  { id: 'build', duration: 16, transition: { type: 'crossfade' as const, duration: 2, curve: 'ease-in-out' as const } },
  { id: 'drop', duration: 8, transition: { type: 'crossfade' as const, duration: 1, curve: 'linear' as const } },
  { id: 'outro', duration: 8, transition: { type: 'crossfade' as const, duration: 4, curve: 'ease-out' as const } }
]

const innerActSegments = [
  { id: 'a', duration: 2, transition: { type: 'crossfade' as const, duration: 0.5, curve: 'linear' as const } },
  { id: 'b', duration: 2, transition: { type: 'crossfade' as const, duration: 0.5, curve: 'linear' as const } },
  { id: 'c', duration: 2, transition: { type: 'cut' as const, duration: 0, curve: 'linear' as const } }
]

const specs: PatchSpec[] = [
  {
    name: 'Scrolling Wave',
    filename: '01-scrolling-wave.pxf',
    description: 'LFO-driven chase on a linear strip — great first patch.',
    layout: lineLayout(170),
    buildGraph: (layout) => ({
      nodes: [
        node('fix', 'setup/fixture', col(0), row(1), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node('lfo', 'time/lfo', col(1), row(2), params('time/lfo', { frequency: 0.2, min: 0, max: 1 })),
        node('wave', 'generator/wave', col(1), row(1), params('generator/wave'), true),
        node('offset', 'transform/offset', col(2), row(1), params('transform/offset', { speed: 0 })),
        node('out', 'output/pixel', col(3), row(1))
      ],
      edges: [
        edge('e0', 'fix', 'pixels', 'wave', 'pixels'),
        edge('e0r', 'fix', 'resolution', 'wave', 'resolution'),
        edge('e1', 'lfo', 'value', 'offset', 'translate'),
        edge('e2', 'wave', 'pixels', 'offset', 'pixels'),
        edge('e3', 'offset', 'pixels', 'out', 'pixels')
      ]
    })
  },
  {
    name: 'Matrix Rainbow',
    filename: '02-matrix-rainbow.pxf',
    description: '16×8 matrix with cylindrical colour sweep and hue spin.',
    layout: matrixLayout(16, 8),
    buildGraph: (layout) => ({
      nodes: [
        node('fix', 'setup/fixture', col(0), row(1), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node('cyl', 'spatial/cylindrical', col(1), row(1), params('spatial/cylindrical', { speed: 0.15 }), true),
        node('hsv', 'colour/hsv-shift', col(2), row(1), params('colour/hsv-shift', { hueSpeed: 0.1 })),
        node('out', 'output/pixel', col(3), row(1))
      ],
      edges: [
        edge('e0', 'fix', 'pixels', 'cyl', 'pixels'),
        edge('e0r', 'fix', 'resolution', 'cyl', 'resolution'),
        edge('e1', 'cyl', 'pixels', 'hsv', 'pixels'),
        edge('e2', 'hsv', 'pixels', 'out', 'pixels')
      ]
    })
  },
  {
    name: 'Audio Reactive',
    filename: '03-audio-reactive.pxf',
    description: 'Blend gradient + noise; audio bands drive mix and travelling mask. Pick device or file on Audio In.',
    layout: lineLayout(64),
    buildGraph: (layout) => ({
      nodes: [
        node('fix', 'setup/fixture', col(0), row(1), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node('audio', 'audio/audio-in', col(0), row(0), params('audio/audio-in', { source: 'file', file: '' })),
        node('grad', 'generator/gradient', col(1), row(0), params('generator/gradient'), true),
        node('noise', 'generator/noise', col(1), row(2), params('generator/noise', { speed: 0.5, noiseType: 'perlin3d' })),
        node('mix', 'composite/mix', col(2), row(1), params('composite/mix', { mode: 'mix', amount: 0.5 })),
        node('mask', 'transform/mask', col(3), row(1), params('transform/mask', { start: 0.2, end: 0.55, softness: 0.08 })),
        node('out', 'output/pixel', col(4), row(1))
      ],
      edges: [
        edge('e0a', 'fix', 'pixels', 'grad', 'pixels'),
        edge('e0b', 'fix', 'pixels', 'noise', 'pixels'),
        edge('e0r', 'fix', 'resolution', 'grad', 'resolution'),
        edge('e0s', 'fix', 'resolution', 'noise', 'resolution'),
        edge('e1', 'grad', 'pixels', 'mix', 'a'),
        edge('e2', 'noise', 'pixels', 'mix', 'b'),
        edge('e3', 'audio', 'mid', 'mix', 'amount'),
        edge('e4', 'mix', 'pixels', 'mask', 'pixels'),
        edge('e5', 'audio', 'low', 'mask', 'offset'),
        edge('e6', 'mask', 'pixels', 'out', 'pixels')
      ]
    })
  },
  {
    name: 'Timeline Sequence',
    filename: '04-bpm-sequence.pxf',
    description:
      'Four-segment show driven by Timeline (16-beat loop). Beat clocks Sequence; phase scrolls the gradient. Use ] to advance manually.',
    layout: lineLayout(64),
    buildGraph: (layout) => ({
      nodes: [
        node('fix', 'setup/fixture', col(0), row(2), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node('timeline', 'time/timeline', col(0), row(0), params('time/timeline', {
          durationMode: 'beats',
          durationBeats: 16,
          bpm: 128,
          loop: true
        })),
        node('red', 'generator/solid-colour', col(1), row(0), params('generator/solid-colour', { colour: { r: 220, g: 40, b: 20 } })),
        node('wave', 'generator/wave', col(1), row(1), params('generator/wave', {
          colourA: { r: 0, g: 0, b: 0 },
          colourB: { r: 30, g: 80, b: 255 }
        })),
        node('grad', 'generator/gradient', col(1), row(2), params('generator/gradient', { speed: 0 })),
        node('noise', 'generator/noise', col(1), row(3), params('generator/noise', { noiseType: 'perlin4d-time' })),
        node('seq', 'sequence/sequence', col(2), row(1.5), params('sequence/sequence', {
          bpm: 128,
          segments: [
            { id: 'seg0', duration: 4, transition: { type: 'crossfade', duration: 1, curve: 'ease-in-out' } },
            { id: 'seg1', duration: 4, transition: { type: 'crossfade', duration: 1, curve: 'ease-in-out' } },
            { id: 'seg2', duration: 4, transition: { type: 'crossfade', duration: 1, curve: 'ease-in-out' } },
            { id: 'seg3', duration: 4, transition: { type: 'crossfade', duration: 1, curve: 'ease-in-out' } }
          ]
        }), true),
        node('out', 'output/pixel', col(3), row(1.5))
      ],
      edges: [
        edge('e0a', 'fix', 'pixels', 'red', 'pixels'),
        edge('e0b', 'fix', 'pixels', 'wave', 'pixels'),
        edge('e0c', 'fix', 'pixels', 'grad', 'pixels'),
        edge('e0d', 'fix', 'pixels', 'noise', 'pixels'),
        edge('e0r', 'fix', 'resolution', 'wave', 'resolution'),
        edge('e0s', 'fix', 'resolution', 'grad', 'resolution'),
        edge('e0t', 'fix', 'resolution', 'noise', 'resolution'),
        edge('e1', 'timeline', 'beat', 'seq', 'beat'),
        edge('e1p', 'timeline', 'phase', 'grad', 'phase'),
        edge('e2', 'red', 'pixels', 'seq', 'segment_0'),
        edge('e3', 'wave', 'pixels', 'seq', 'segment_1'),
        edge('e4', 'grad', 'pixels', 'seq', 'segment_2'),
        edge('e5', 'noise', 'pixels', 'seq', 'segment_3'),
        edge('e6', 'seq', 'pixels', 'out', 'pixels')
      ]
    })
  },
  {
    name: 'Ring Pulse',
    filename: '05-ring-pulse.pxf',
    description: 'Distance-field ring with LFO-pulsed strobe overlay.',
    layout: ringLayout(60),
    buildGraph: (layout) => ({
      nodes: [
        node('fix', 'setup/fixture', col(0), row(1), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node('lfo', 'time/lfo', col(0), row(0), params('time/lfo', { frequency: 1, waveform: 'sine' })),
        node('dist', 'spatial/distance-field', col(1), row(1), params('spatial/distance-field'), true),
        node('strobe', 'generator/strobe', col(1), row(2), params('generator/strobe', { rate: 4, duty: 0.3 })),
        node('mix', 'composite/mix', col(2), row(1.5), params('composite/mix', { mode: 'mix', amount: 0.3 })),
        node('levels', 'colour/levels', col(3), row(1.5), params('colour/levels', { brightness: 1.2 })),
        node('out', 'output/pixel', col(4), row(1.5))
      ],
      edges: [
        edge('e0a', 'fix', 'pixels', 'dist', 'pixels'),
        edge('e0b', 'fix', 'pixels', 'strobe', 'pixels'),
        edge('e0r', 'fix', 'resolution', 'dist', 'resolution'),
        edge('e1', 'dist', 'pixels', 'mix', 'a'),
        edge('e2', 'strobe', 'pixels', 'mix', 'b'),
        edge('e3', 'lfo', 'value', 'mix', 'amount'),
        edge('e4', 'mix', 'pixels', 'levels', 'pixels'),
        edge('e5', 'levels', 'pixels', 'out', 'pixels')
      ]
    })
  },
  {
    name: 'Logic Switch Demo',
    filename: '06-logic-switch.pxf',
    description: 'LFO toggles between two looks using Compare + Switch.',
    layout: lineLayout(64),
    buildGraph: (layout) => ({
      nodes: [
        node('fix', 'setup/fixture', col(0), row(1.5), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node('lfo', 'time/lfo', col(0), row(0), params('time/lfo', { frequency: 0.5, waveform: 'square' })),
        node('cmp', 'logic/compare', col(1), row(0), params('logic/compare', { op: 'gt', b: 0.5 })),
        node('warm', 'generator/gradient', col(1), row(1), params('generator/gradient', {
          stops: gradientStops({ r: 255, g: 120, b: 0 }, { r: 255, g: 40, b: 80 })
        }), true),
        node('cool', 'generator/gradient', col(1), row(2), params('generator/gradient', {
          stops: gradientStops({ r: 0, g: 80, b: 255 }, { r: 80, g: 255, b: 200 })
        })),
        node('sw', 'logic/switch', col(2), row(1.5), params('logic/switch', { threshold: 0.5 })),
        node('out', 'output/pixel', col(3), row(1.5))
      ],
      edges: [
        edge('e0a', 'fix', 'pixels', 'warm', 'pixels'),
        edge('e0b', 'fix', 'pixels', 'cool', 'pixels'),
        edge('e0r', 'fix', 'resolution', 'warm', 'resolution'),
        edge('e0s', 'fix', 'resolution', 'cool', 'resolution'),
        edge('e1', 'lfo', 'value', 'cmp', 'a'),
        edge('e2', 'cmp', 'value', 'sw', 'select'),
        edge('e3', 'warm', 'pixels', 'sw', 'a'),
        edge('e4', 'cool', 'pixels', 'sw', 'b'),
        edge('e5', 'sw', 'pixels', 'out', 'pixels')
      ]
    })
  },

  // ---- Complex examples -------------------------------------------------------

  {
    name: 'Club Show (Matrix)',
    filename: '07-club-show.pxf',
    description:
      'Full 4-act matrix show: Timeline-driven sequence (40-beat loop), per-act FX chains, audio intensity + strobe, vignette finish.',
    layout: matrixLayout(16, 8),
    buildGraph: (layout) => ({
      nodes: [
        // Controls
        node('fix', 'setup/fixture', col(0), row(2), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node('timeline', 'time/timeline', col(0), row(0), params('time/timeline', {
          durationMode: 'beats',
          durationBeats: 40,
          bpm: 128,
          loop: true
        })),
        node('audio', 'audio/audio-in', col(0), row(1), params('audio/audio-in', { source: 'file', file: '' })),
        node('lfo1', 'time/lfo', col(0), row(3), params('time/lfo', { frequency: 0.15, waveform: 'sine' })),
        node('lfo2', 'time/lfo', col(0), row(4), params('time/lfo', { frequency: 0.4, waveform: 'triangle' })),

        // Act 1 — tunnel
        node('cyl', 'spatial/cylindrical', col(1), row(0), params('spatial/cylindrical', { speed: 0.12 })),
        node('rot1', 'transform/rotate', col(2), row(0), params('transform/rotate', { speed: 0.03 })),
        node('hsv1', 'colour/hsv-shift', col(3), row(0), params('colour/hsv-shift', { hueSpeed: 0.08 })),

        // Act 2 — chase
        node('wave', 'generator/wave', col(1), row(1), params('generator/wave', { frequency: 3, speed: 0.8 })),
        node('off', 'transform/offset', col(2), row(1), params('transform/offset', { speed: 0 })),
        node('mir', 'transform/mirror', col(3), row(1), params('transform/mirror', { mode: 'flip' })),
        node('msk', 'transform/mask', col(4), row(1), params('transform/mask', { start: 0.15, end: 0.45, softness: 0.12 })),

        // Act 3 — texture
        node('noise', 'generator/noise', col(1), row(2), params('generator/noise', { scale: 6, speed: 1.2, noiseType: 'perlin3d' })),
        node('pal', 'colour/palette-map', col(2), row(2), params('colour/palette-map')),
        node('crv', 'colour/curves', col(3), row(2), params('colour/curves', { midtones: 0.15 })),
        node('lvl', 'colour/levels', col(4), row(2), params('colour/levels', { contrast: 1.3 })),

        // Act 4 — impact
        node('dist', 'spatial/distance-field', col(1), row(3), params('spatial/distance-field', { scale: 1.2 })),
        node('strobe', 'generator/strobe', col(1), row(4), params('generator/strobe', { rate: 8, duty: 0.2 })),
        node('hit', 'composite/mix', col(2), row(3.5), params('composite/mix', { mode: 'screen', amount: 0.6 })),

        // Master sequence + post
        node('seq', 'sequence/sequence', col(5), row(1.5), params('sequence/sequence', { bpm: 128, segments: showSegments }), true),
        node('cc', 'colour/correct', col(6), row(1.5), params('colour/correct', { gain: 1.1, temperature: 0.1 })),
        node('vig', 'spatial/distance-field', col(6), row(3), params('spatial/distance-field', {
          from: { r: 0, g: 0, b: 0 },
          to: { r: 40, g: 40, b: 60 },
          scale: 0.8
        })),
        node('fin', 'composite/over', col(7), row(2), params('composite/over', { opacity: 0.35 })),
        node('out', 'output/pixel', col(8), row(2))
      ],
      edges: [
        edge('f0', 'fix', 'pixels', 'cyl', 'pixels'),
        edge('f1', 'fix', 'pixels', 'wave', 'pixels'),
        edge('f2', 'fix', 'pixels', 'noise', 'pixels'),
        edge('f3', 'fix', 'pixels', 'dist', 'pixels'),
        edge('f4', 'fix', 'pixels', 'strobe', 'pixels'),
        edge('f5', 'fix', 'pixels', 'vig', 'pixels'),
        edge('fr', 'fix', 'resolution', 'cyl', 'resolution'),
        edge('fw', 'fix', 'resolution', 'wave', 'resolution'),
        edge('fn', 'fix', 'resolution', 'noise', 'resolution'),
        edge('fd', 'fix', 'resolution', 'dist', 'resolution'),
        edge('fv', 'fix', 'resolution', 'vig', 'resolution'),

        edge('a1', 'cyl', 'pixels', 'rot1', 'pixels'),
        edge('a2', 'rot1', 'pixels', 'hsv1', 'pixels'),
        edge('a3', 'lfo1', 'value', 'rot1', 'angle'),

        edge('b1', 'wave', 'pixels', 'off', 'pixels'),
        edge('b2', 'lfo2', 'value', 'off', 'translate'),
        edge('b3', 'off', 'pixels', 'mir', 'pixels'),
        edge('b4', 'mir', 'pixels', 'msk', 'pixels'),
        edge('b5', 'lfo1', 'value', 'msk', 'offset'),

        edge('c1', 'noise', 'pixels', 'pal', 'pixels'),
        edge('c2', 'pal', 'pixels', 'crv', 'pixels'),
        edge('c3', 'crv', 'pixels', 'lvl', 'pixels'),

        edge('d1', 'dist', 'pixels', 'hit', 'a'),
        edge('d2', 'strobe', 'pixels', 'hit', 'b'),
        edge('d3', 'audio', 'high', 'hit', 'amount'),

        edge('s0', 'hsv1', 'pixels', 'seq', 'segment_0'),
        edge('s1', 'msk', 'pixels', 'seq', 'segment_1'),
        edge('s2', 'lvl', 'pixels', 'seq', 'segment_2'),
        edge('s3', 'hit', 'pixels', 'seq', 'segment_3'),
        edge('s4', 'timeline', 'beat', 'seq', 'beat'),
        edge('s5', 'audio', 'low', 'seq', 'intensity'),

        edge('p1', 'seq', 'pixels', 'cc', 'pixels'),
        edge('p2', 'cc', 'pixels', 'fin', 'a'),
        edge('p3', 'vig', 'pixels', 'fin', 'b'),
        edge('p4', 'fin', 'pixels', 'out', 'pixels')
      ]
    })
  },

  {
    name: 'Nested Acts',
    filename: '08-nested-acts.pxf',
    description:
      'Sequence inside a sequence: Timeline (32-beat loop) clocks both layers; loop trigger restarts Ramp; audio crossfade control.',
    layout: lineLayout(128),
    buildGraph: (layout) => ({
      nodes: [
        node('fix', 'setup/fixture', col(0), row(2), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node('timeline', 'time/timeline', col(0), row(0), params('time/timeline', {
          durationMode: 'beats',
          durationBeats: 32,
          bpm: 120,
          loop: true
        })),
        node('audio', 'audio/audio-in', col(0), row(1), params('audio/audio-in')),
        node('ramp', 'time/ramp', col(0), row(3), params('time/ramp', { seconds: 16, loop: false })),

        // Inner sequence sources
        node('solid', 'generator/solid-colour', col(1), row(0), params('generator/solid-colour', { colour: { r: 180, g: 20, b: 60 } })),
        node('wave', 'generator/wave', col(1), row(1), params('generator/wave', { speed: 1.2, frequency: 4 })),
        node('noise', 'generator/noise', col(1), row(2), params('generator/noise', { speed: 2, scale: 8, noiseType: 'value3d' })),
        node('seq-in', 'sequence/sequence', col(2), row(1), params('sequence/sequence', {
          bpm: 120,
          segments: innerActSegments
        })),

        // Outer act B — heavy processing chain
        node('grad', 'generator/gradient', col(1), row(4), params('generator/gradient', {
          stops: gradientStops({ r: 0, g: 40, b: 120 }, { r: 200, g: 255, b: 180 }),
          axis: 'xy'
        })),
        node('tfm', 'transform/transform', col(2), row(4), params('transform/transform', { speed: 0.25, scale: 1.5 })),
        node('hsv', 'colour/hsv-shift', col(3), row(4), params('colour/hsv-shift', { hueSpeed: 0.2 })),
        node('rot', 'transform/rotate', col(4), row(4), params('transform/rotate', { speed: 0.08 })),
        node('mix', 'composite/mix', col(5), row(4), params('composite/mix', { mode: 'multiply', amount: 0.4 })),
        node('strobe', 'generator/strobe', col(1), row(5), params('generator/strobe', { rate: 6, duty: 0.15 })),

        // Outer sequence + finish
        node('seq-out', 'sequence/sequence', col(6), row(2), params('sequence/sequence', {
          bpm: 120,
          segments: [
            { id: 'act1', duration: 16, transition: { type: 'crossfade', duration: 3, curve: 'ease-in-out' } },
            { id: 'act2', duration: 16, transition: { type: 'crossfade', duration: 3, curve: 'ease-in-out' } }
          ]
        }), true),
        node('lvl', 'colour/levels', col(7), row(2), params('colour/levels', { brightness: 1.15, gamma: 0.9 })),
        node('out', 'output/pixel', col(8), row(2))
      ],
      edges: [
        edge('f0a', 'fix', 'pixels', 'solid', 'pixels'),
        edge('f0b', 'fix', 'pixels', 'wave', 'pixels'),
        edge('f0c', 'fix', 'pixels', 'noise', 'pixels'),
        edge('f0d', 'fix', 'pixels', 'grad', 'pixels'),
        edge('f0e', 'fix', 'pixels', 'strobe', 'pixels'),
        edge('f0r', 'fix', 'resolution', 'wave', 'resolution'),
        edge('f0s', 'fix', 'resolution', 'noise', 'resolution'),
        edge('f0t', 'fix', 'resolution', 'grad', 'resolution'),

        edge('i1', 'solid', 'pixels', 'seq-in', 'segment_0'),
        edge('i2', 'wave', 'pixels', 'seq-in', 'segment_1'),
        edge('i3', 'noise', 'pixels', 'seq-in', 'segment_2'),
        edge('i4', 'timeline', 'beat', 'seq-in', 'beat'),

        edge('o1', 'grad', 'pixels', 'tfm', 'pixels'),
        edge('o2', 'ramp', 'value', 'tfm', 'translate'),
        edge('o2t', 'timeline', 'loop', 'ramp', 'trigger'),
        edge('o3', 'tfm', 'pixels', 'hsv', 'pixels'),
        edge('o4', 'hsv', 'pixels', 'rot', 'pixels'),
        edge('o5', 'rot', 'pixels', 'mix', 'a'),
        edge('o6', 'strobe', 'pixels', 'mix', 'b'),
        edge('o7', 'audio', 'mid', 'mix', 'amount'),

        edge('m1', 'seq-in', 'pixels', 'seq-out', 'segment_0'),
        edge('m2', 'mix', 'pixels', 'seq-out', 'segment_1'),
        edge('m3', 'timeline', 'beat', 'seq-out', 'beat'),
        edge('m4', 'audio', 'high', 'seq-out', 'intensity'),

        edge('f1', 'seq-out', 'pixels', 'lvl', 'pixels'),
        edge('f2', 'lvl', 'pixels', 'out', 'pixels')
      ]
    })
  },

  {
    name: 'Venue Install',
    filename: '09-venue-install.pxf',
    description:
      'Bar + ring + matrix: fixture-scoped branches mapped back with Fixture, Merge compositing, Timeline sequence, spherical base.',
    layout: venueLayout(),
    buildGraph: (layout) => ({
      nodes: [
        // Per-fixture scope sources
        node('fix-bar', 'setup/fixture', col(0), row(0), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node('fix-ring', 'setup/fixture', col(0), row(2), params('setup/fixture', { fixtureId: fid(layout, 1) })),
        node('fix-wall', 'setup/fixture', col(0), row(4), params('setup/fixture', { fixtureId: fid(layout, 2) })),

        // Global controls
        node('lfo-a', 'time/lfo', col(0), row(5.5), params('time/lfo', { frequency: 0.08, waveform: 'sine' })),
        node('lfo-b', 'time/lfo', col(0), row(6.5), params('time/lfo', { frequency: 0.25, waveform: 'saw' })),
        node('lfo-c', 'time/lfo', col(0), row(7.5), params('time/lfo', { frequency: 1.2, waveform: 'square' })),
        node('delay', 'time/delay', col(0), row(8.5), params('time/delay', { seconds: 0.15 })),
        node('timeline', 'time/timeline', col(0), row(9.5), params('time/timeline', {
          durationMode: 'beats',
          durationBeats: 36,
          bpm: 90,
          loop: true
        })),

        // Branch A — bar
        node('gra', 'generator/gradient', col(1), row(0), params('generator/gradient', { axis: 'x', scale: 2 })),
        node('sca', 'transform/scale', col(2), row(0), params('transform/scale', { scale: 2 })),
        node('off', 'transform/offset', col(3), row(0), params('transform/offset', { speed: 0.15 })),
        node('map-bar', 'setup/fixture', col(4), row(0), params('setup/fixture', { fixtureId: fid(layout, 0) })),

        // Branch B — ring
        node('cyl', 'spatial/cylindrical', col(1), row(2), params('spatial/cylindrical', { speed: 0.06 })),
        node('rot', 'transform/rotate', col(2), row(2), params('transform/rotate', { centreU: 0.5, centreV: 0.55 })),
        node('map-ring', 'setup/fixture', col(4), row(2), params('setup/fixture', { fixtureId: fid(layout, 1) })),

        // Branch C — wall
        node('noi', 'generator/noise', col(1), row(4), params('generator/noise', { scale: 4, speed: 0.4, noiseType: 'perlin4d-time' })),
        node('pal', 'colour/palette-map', col(2), row(4), params('colour/palette-map', {
          dark: { r: 10, g: 0, b: 40 },
          light: { r: 255, g: 100, b: 180 }
        })),
        node('map-wall', 'setup/fixture', col(4), row(4), params('setup/fixture', { fixtureId: fid(layout, 2) })),

        // Spherical ambient base (full patch) + merge fixture branches
        node('sph', 'spatial/spherical', col(1), row(6), params('spatial/spherical', { speed: 0.02 }), true),
        node('merge', 'composite/merge', col(5), row(2), params('composite/merge', { mode: 'add' })),
        node('ovr', 'composite/over', col(6), row(3), params('composite/over', { opacity: 0.65 })),

        // Logic accent layer
        node('cmp', 'logic/compare', col(5), row(5), params('logic/compare', { op: 'gt', b: 0.7 })),
        node('str', 'generator/strobe', col(5), row(6), params('generator/strobe', { rate: 3, duty: 0.1 })),
        node('sw', 'logic/switch', col(6), row(5.5), params('logic/switch')),
        node('scr', 'composite/screen', col(7), row(5.5), params('composite/screen', { amount: 0.25 })),

        // Master sequence + output
        node('seq', 'sequence/sequence', col(8), row(3), params('sequence/sequence', {
          bpm: 90,
          segments: [
            { id: 'm1', duration: 12, transition: { type: 'crossfade', duration: 3, curve: 'ease-in-out' } },
            { id: 'm2', duration: 12, transition: { type: 'crossfade', duration: 3, curve: 'ease-in-out' } },
            { id: 'm3', duration: 12, transition: { type: 'crossfade', duration: 3, curve: 'ease-in-out' } }
          ]
        })),
        node('cc', 'colour/correct', col(9), row(3), params('colour/correct', { lift: 0.02, gamma: 1.1 })),
        node('out', 'output/pixel', col(10), row(3))
      ],
      edges: [
        edge('b0a', 'fix-bar', 'pixels', 'gra', 'pixels'),
        edge('b0r', 'fix-bar', 'resolution', 'gra', 'resolution'),
        edge('b1a', 'fix-ring', 'pixels', 'cyl', 'pixels'),
        edge('b1r', 'fix-ring', 'resolution', 'cyl', 'resolution'),
        edge('b2a', 'fix-wall', 'pixels', 'noi', 'pixels'),
        edge('b2r', 'fix-wall', 'resolution', 'noi', 'resolution'),

        edge('b1', 'gra', 'pixels', 'sca', 'pixels'),
        edge('b2', 'lfo-a', 'value', 'off', 'translate'),
        edge('b3', 'sca', 'pixels', 'off', 'pixels'),
        edge('b3m', 'off', 'pixels', 'map-bar', 'pixels'),

        edge('b4', 'cyl', 'pixels', 'rot', 'pixels'),
        edge('b5', 'lfo-b', 'value', 'rot', 'angle'),
        edge('b5m', 'rot', 'pixels', 'map-ring', 'pixels'),

        edge('b6', 'noi', 'pixels', 'pal', 'pixels'),
        edge('b6m', 'pal', 'pixels', 'map-wall', 'pixels'),

        edge('x1', 'map-bar', 'pixels', 'merge', 'a'),
        edge('x2', 'map-ring', 'pixels', 'merge', 'b'),
        edge('x3', 'map-wall', 'pixels', 'merge', 'c'),
        edge('x5', 'merge', 'pixels', 'ovr', 'b'),
        edge('x6', 'sph', 'pixels', 'ovr', 'a'),

        edge('l1', 'lfo-c', 'value', 'delay', 'value'),
        edge('l2', 'delay', 'value', 'cmp', 'a'),
        edge('l3', 'cmp', 'value', 'sw', 'select'),
        edge('l4', 'ovr', 'pixels', 'sw', 'a'),
        edge('l5', 'str', 'pixels', 'sw', 'b'),
        edge('l6', 'sw', 'pixels', 'scr', 'a'),
        edge('l7', 'ovr', 'pixels', 'scr', 'b'),

        edge('s1', 'scr', 'pixels', 'seq', 'segment_0'),
        edge('s2', 'merge', 'pixels', 'seq', 'segment_1'),
        edge('s3', 'sph', 'pixels', 'seq', 'segment_2'),
        edge('s4', 'timeline', 'beat', 'seq', 'beat'),

        edge('f1', 'seq', 'pixels', 'cc', 'pixels'),
        edge('f2', 'cc', 'pixels', 'out', 'pixels')
      ]
    })
  },

  {
    name: 'Signal Labyrinth',
    filename: '10-signal-labyrinth.pxf',
    description:
      'Deep float routing (delay/hold/ramp/gate/compare) driving a 5-layer pixel compositing stack on a 32×8 matrix.',
    layout: matrixLayout(32, 8),
    buildGraph: (layout) => ({
      nodes: [
        node('fix', 'setup/fixture', col(0), row(3), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node('audio', 'audio/audio-in', col(0), row(0), params('audio/audio-in')),
        node('lfo1', 'time/lfo', col(0), row(1), params('time/lfo', { frequency: 0.3, waveform: 'sine' })),
        node('lfo2', 'time/lfo', col(0), row(2), params('time/lfo', { frequency: 0.7, waveform: 'triangle' })),
        node('ramp', 'time/ramp', col(0), row(4), params('time/ramp', { seconds: 8, loop: true })),

        // Float routing column
        node('dly', 'time/delay', col(1), row(0), params('time/delay', { seconds: 0.2 })),
        node('hld', 'time/hold', col(1), row(1), params('time/hold', { seconds: 0.4 })),
        node('cmp', 'logic/compare', col(1), row(2), params('logic/compare', { op: 'gt', b: 0.55 })),
        node('gate', 'logic/gate', col(1), row(3), params('logic/gate', { threshold: 0.5 })),
        node('swf', 'logic/switch-float', col(1), row(4), params('logic/switch-float')),

        // Pixel layers
        node('lay1', 'spatial/cylindrical', col(2), row(0), params('spatial/cylindrical', { speed: 0.1 })),
        node('lay2', 'generator/wave', col(2), row(1), params('generator/wave', { frequency: 5, speed: 0.6 })),
        node('lay3', 'generator/noise', col(2), row(2), params('generator/noise', { scale: 10, speed: 1.5, noiseType: 'perlin4d-space' })),
        node('lay4', 'spatial/distance-field', col(2), row(3), params('spatial/distance-field')),
        node('lay5', 'generator/strobe', col(2), row(4), params('generator/strobe', { rate: 10, duty: 0.08 })),

        // Compositing stack
        node('mx1', 'composite/mix', col(3), row(0.5), params('composite/mix', { mode: 'mix', amount: 0.5 })),
        node('mx2', 'composite/screen', col(4), row(1), params('composite/screen', { amount: 0.35 })),
        node('mx3', 'composite/multiply', col(5), row(1.5), params('composite/multiply', { amount: 0.5 })),
        node('mx4', 'composite/add', col(6), row(2), params('composite/add', { amount: 0.3 })),

        // Finish
        node('hsv', 'colour/hsv-shift', col(7), row(2), params('colour/hsv-shift')),
        node('crv', 'colour/curves', col(8), row(2), params('colour/curves', { highlights: 0.2 })),
        node('msk', 'transform/mask', col(9), row(2), params('transform/mask', { start: 0.1, end: 0.9, softness: 0.15 })),
        node('out', 'output/pixel', col(10), row(2))
      ],
      edges: [
        edge('f0', 'fix', 'pixels', 'lay1', 'pixels'),
        edge('f1', 'fix', 'pixels', 'lay2', 'pixels'),
        edge('f2', 'fix', 'pixels', 'lay3', 'pixels'),
        edge('f3', 'fix', 'pixels', 'lay4', 'pixels'),
        edge('f4', 'fix', 'pixels', 'lay5', 'pixels'),
        edge('fr', 'fix', 'resolution', 'lay1', 'resolution'),
        edge('fw', 'fix', 'resolution', 'lay2', 'resolution'),
        edge('fn', 'fix', 'resolution', 'lay3', 'resolution'),
        edge('fd', 'fix', 'resolution', 'lay4', 'resolution'),

        // Float labyrinth
        edge('f1a', 'audio', 'low', 'dly', 'value'),
        edge('f2', 'dly', 'value', 'hld', 'value'),
        edge('f3', 'audio', 'mid', 'cmp', 'a'),
        edge('f4', 'cmp', 'value', 'swf', 'select'),
        edge('f5', 'lfo1', 'value', 'swf', 'a'),
        edge('f6', 'ramp', 'value', 'swf', 'b'),
        edge('f7', 'swf', 'value', 'gate', 'gate'),
        edge('f8', 'audio', 'high', 'gate', 'value'),
        edge('f9', 'gate', 'value', 'mx1', 'amount'),
        edge('f10', 'lfo2', 'value', 'mx2', 'amount'),
        edge('f11', 'ramp', 'value', 'mx3', 'amount'),
        edge('f12', 'hld', 'value', 'msk', 'offset'),

        // Pixel stack
        edge('p1', 'lay1', 'pixels', 'mx1', 'a'),
        edge('p2', 'lay2', 'pixels', 'mx1', 'b'),
        edge('p3', 'mx1', 'pixels', 'mx2', 'a'),
        edge('p4', 'lay3', 'pixels', 'mx2', 'b'),
        edge('p5', 'mx2', 'pixels', 'mx3', 'a'),
        edge('p6', 'lay4', 'pixels', 'mx3', 'b'),
        edge('p7', 'mx3', 'pixels', 'mx4', 'a'),
        edge('p8', 'lay5', 'pixels', 'mx4', 'b'),
        edge('p9', 'mx4', 'pixels', 'hsv', 'pixels'),
        edge('p10', 'hsv', 'pixels', 'crv', 'pixels'),
        edge('p11', 'crv', 'pixels', 'msk', 'pixels'),
        edge('p12', 'msk', 'pixels', 'out', 'pixels')
      ]
    })
  },

  // ---- Visual looks (self-running 2D; no audio / sequence) --------------------

  {
    name: 'Plasma Field',
    filename: '11-plasma-field.pxf',
    description: 'Shader plasma on a 32×16 matrix with a slow hue drift — a looping 2D field.',
    layout: matrixLayout(32, 16),
    buildGraph: (layout) => ({
      nodes: [
        node('fix', 'setup/fixture', col(0), row(1), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node(
          'plasma',
          'generator/shader',
          col(1),
          row(1),
          params('generator/shader', {
            preset: 'plasma',
            speed: 0.55,
            scale: 1.35,
            colourA: { r: 8, g: 12, b: 90 },
            colourB: { r: 0, g: 220, b: 190 },
            intensity: 1.1
          }),
          true
        ),
        node('hsv', 'colour/hsv-shift', col(2), row(1), params('colour/hsv-shift', { hueSpeed: 0.035, saturation: 1.05 })),
        node('out', 'output/pixel', col(3), row(1))
      ],
      edges: [
        edge('e0', 'fix', 'pixels', 'plasma', 'pixels'),
        edge('e0r', 'fix', 'resolution', 'plasma', 'resolution'),
        edge('e1', 'plasma', 'pixels', 'hsv', 'pixels'),
        edge('e2', 'hsv', 'pixels', 'out', 'pixels')
      ]
    })
  },

  {
    name: 'Tunnel Ride',
    filename: '12-tunnel-ride.pxf',
    description: 'Shader tunnel spinning through UV rotate — depth without a sequence.',
    layout: matrixLayout(32, 16),
    buildGraph: (layout) => ({
      nodes: [
        node('fix', 'setup/fixture', col(0), row(1), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node(
          'tunnel',
          'generator/shader',
          col(1),
          row(1),
          params('generator/shader', {
            preset: 'tunnel',
            speed: 0.7,
            scale: 1.15,
            colourA: { r: 40, g: 0, b: 70 },
            colourB: { r: 255, g: 140, b: 40 },
            intensity: 1.15
          }),
          true
        ),
        node('rot', 'transform/rotate', col(2), row(1), params('transform/rotate', { speed: 0.045 })),
        node('lvl', 'colour/levels', col(3), row(1), params('colour/levels', { contrast: 1.2, gamma: 0.92 })),
        node('out', 'output/pixel', col(4), row(1))
      ],
      edges: [
        edge('e0', 'fix', 'pixels', 'tunnel', 'pixels'),
        edge('e0r', 'fix', 'resolution', 'tunnel', 'resolution'),
        edge('e1', 'tunnel', 'pixels', 'rot', 'pixels'),
        edge('e1r', 'fix', 'resolution', 'rot', 'resolution'),
        edge('e2', 'rot', 'pixels', 'lvl', 'pixels'),
        edge('e3', 'lvl', 'pixels', 'out', 'pixels')
      ]
    })
  },

  {
    name: 'Aurora Veil',
    filename: '13-aurora-veil.pxf',
    description: 'Soft aurora shader through a box blur — atmospheric sheet lighting.',
    layout: matrixLayout(32, 16),
    buildGraph: (layout) => ({
      nodes: [
        node('fix', 'setup/fixture', col(0), row(1), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node(
          'aurora',
          'generator/shader',
          col(1),
          row(1),
          params('generator/shader', {
            preset: 'aurora',
            speed: 0.32,
            scale: 1.7,
            colourA: { r: 0, g: 40, b: 70 },
            colourB: { r: 80, g: 255, b: 160 },
            intensity: 1.05
          }),
          true
        ),
        node('blur', 'transform/blur', col(2), row(1), params('transform/blur', { radius: 3, direction: 'both' })),
        node('cc', 'colour/correct', col(3), row(1), params('colour/correct', { temperature: -0.12, gain: 1.08 })),
        node('out', 'output/pixel', col(4), row(1))
      ],
      edges: [
        edge('e0', 'fix', 'pixels', 'aurora', 'pixels'),
        edge('e0r', 'fix', 'resolution', 'aurora', 'resolution'),
        edge('e1', 'aurora', 'pixels', 'blur', 'pixels'),
        edge('e1r', 'fix', 'resolution', 'blur', 'resolution'),
        edge('e2', 'blur', 'pixels', 'cc', 'pixels'),
        edge('e3', 'cc', 'pixels', 'out', 'pixels')
      ]
    })
  },

  {
    name: 'Kaleido Garden',
    filename: '14-kaleido-garden.pxf',
    description: 'Perlin noise folded into 8 kaleidoscope segments with a slow hue spin.',
    layout: matrixLayout(24, 24),
    buildGraph: (layout) => ({
      nodes: [
        node('fix', 'setup/fixture', col(0), row(1), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node(
          'noise',
          'generator/noise',
          col(1),
          row(1),
          params('generator/noise', {
            noiseType: 'perlin4d-time',
            scale: 4.5,
            speed: 0.35,
            colourA: { r: 12, g: 0, b: 48 },
            colourB: { r: 255, g: 170, b: 40 },
            contrast: 1.25
          }),
          true
        ),
        node(
          'kal',
          'transform/kaleidoscope',
          col(2),
          row(1),
          params('transform/kaleidoscope', { segments: 8, mode: 'mirror' })
        ),
        node('hsv', 'colour/hsv-shift', col(3), row(1), params('colour/hsv-shift', { hueSpeed: 0.05, saturation: 1.1 })),
        node('out', 'output/pixel', col(4), row(1))
      ],
      edges: [
        edge('e0', 'fix', 'pixels', 'noise', 'pixels'),
        edge('e0r', 'fix', 'resolution', 'noise', 'resolution'),
        edge('e1', 'noise', 'pixels', 'kal', 'pixels'),
        edge('e1r', 'fix', 'resolution', 'kal', 'resolution'),
        edge('e2', 'kal', 'pixels', 'hsv', 'pixels'),
        edge('e3', 'hsv', 'pixels', 'out', 'pixels')
      ]
    })
  },

  {
    name: 'Ember Trails',
    filename: '15-ember-trails.pxf',
    description: 'Procedural fire with Feedback persistence — rising embers and smear.',
    layout: matrixLayout(24, 16),
    buildGraph: (layout) => ({
      nodes: [
        node('fix', 'setup/fixture', col(0), row(1), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node(
          'fire',
          'generator/fire',
          col(1),
          row(1),
          params('generator/fire', { scale: 5, speed: 1.05, turbulence: 0.7, rise: 0.62 }),
          true
        ),
        node(
          'fb',
          'composite/feedback',
          col(2),
          row(1),
          params('composite/feedback', { mode: 'screen', amount: 0.72, decay: 0.92 })
        ),
        node('lvl', 'colour/levels', col(3), row(1), params('colour/levels', { brightness: 1.12, contrast: 1.15 })),
        node('out', 'output/pixel', col(4), row(1))
      ],
      edges: [
        edge('e0', 'fix', 'pixels', 'fire', 'pixels'),
        edge('e0r', 'fix', 'resolution', 'fire', 'resolution'),
        edge('e1', 'fire', 'pixels', 'fb', 'pixels'),
        edge('e2', 'fb', 'pixels', 'lvl', 'pixels'),
        edge('e3', 'lvl', 'pixels', 'out', 'pixels')
      ]
    })
  },

  {
    name: 'Ripple Warp',
    filename: '16-ripple-warp.pxf',
    description: 'Ripple shader warped by slow noise — TouchDesigner-style UV displace.',
    layout: matrixLayout(32, 16),
    buildGraph: (layout) => ({
      nodes: [
        node('fix', 'setup/fixture', col(0), row(1.5), params('setup/fixture', { fixtureId: fid(layout, 0) })),
        node(
          'ripples',
          'generator/shader',
          col(1),
          row(1),
          params('generator/shader', {
            preset: 'ripples',
            speed: 0.55,
            scale: 1.4,
            colourA: { r: 0, g: 30, b: 90 },
            colourB: { r: 120, g: 230, b: 255 },
            intensity: 1.1
          }),
          true
        ),
        node(
          'map',
          'generator/noise',
          col(1),
          row(2),
          params('generator/noise', {
            noiseType: 'perlin3d',
            scale: 3.5,
            speed: 0.22,
            colourA: { r: 0, g: 0, b: 0 },
            colourB: { r: 255, g: 255, b: 255 },
            contrast: 0.85
          })
        ),
        node(
          'warp',
          'transform/displace',
          col(2),
          row(1.5),
          params('transform/displace', { amount: 6, mode: 'luminance-x', edges: 'wrap' })
        ),
        node('out', 'output/pixel', col(3), row(1.5))
      ],
      edges: [
        edge('e0', 'fix', 'pixels', 'ripples', 'pixels'),
        edge('e0r', 'fix', 'resolution', 'ripples', 'resolution'),
        edge('e1', 'fix', 'pixels', 'map', 'pixels'),
        edge('e1r', 'fix', 'resolution', 'map', 'resolution'),
        edge('e2', 'ripples', 'pixels', 'warp', 'pixels'),
        edge('e3', 'map', 'pixels', 'warp', 'map'),
        edge('e3r', 'fix', 'resolution', 'warp', 'resolution'),
        edge('e4', 'warp', 'pixels', 'out', 'pixels')
      ]
    })
  }
]

mkdirSync(OUT, { recursive: true })

const manifest: Array<{ filename: string; name: string; description: string }> = []

for (const spec of specs) {
  const { points } = buildLayoutPoints(spec.layout)
  const project = createProjectFile(spec.name, spec.buildGraph(spec.layout), { points, layout: spec.layout }, DEFAULT_ENGINE_CONFIG)
  project.meta.name = spec.name
  writeFileSync(join(OUT, spec.filename), JSON.stringify(project, null, 2), 'utf-8')
  manifest.push({ filename: spec.filename, name: spec.name, description: spec.description })
  console.log(`Wrote ${spec.filename}`)
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
console.log('Done.')
