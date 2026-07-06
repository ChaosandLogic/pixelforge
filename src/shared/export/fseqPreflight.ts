import { OUTPUT_NODE_TYPE } from '../graph/nodes'
import { AUDIO_IN_NODE_TYPE } from '../graph/nodes/audio/AudioIn'
import { KEYBOARD_IN_NODE_TYPE } from '../graph/nodes/input/KeyboardIn'
import { MIDI_IN_NODE_TYPE } from '../graph/nodes/input/MidiIn'
import { OSC_IN_NODE_TYPE } from '../graph/nodes/input/OscIn'
import type { GraphData } from '../graph/types'
import { estimateFseqBytes, stepTimeFromFps } from './fseq'
import { bakeExportWarnings } from './loopPeriod'

const LIVE_INPUT_TYPES = new Set([
  AUDIO_IN_NODE_TYPE,
  MIDI_IN_NODE_TYPE,
  KEYBOARD_IN_NODE_TYPE,
  OSC_IN_NODE_TYPE
])

export interface FseqPreflightResult {
  canExport: boolean
  errors: string[]
  warnings: string[]
}

export function fseqExportPreflight(
  graph: GraphData,
  pixelCount: number,
  durationSec: number,
  fps: number,
  graphError: string | null,
  seamlessLoop = false,
  loopPeriodSec: number | null = null
): FseqPreflightResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (graphError !== null) errors.push(graphError)
  if (pixelCount <= 0) errors.push('Patch has no pixels configured.')

  const stepTimeMs = stepTimeFromFps(fps)
  if (stepTimeMs === null) {
    errors.push(
      `FPS ${fps} is not compatible with FSEQ (step time must be 1–255 ms). Try 4–1000 fps.`
    )
  }

  const hasOutput = graph.nodes.some((n) => n.type === OUTPUT_NODE_TYPE)
  if (!hasOutput) errors.push('Graph needs a Pixel Output node to bake.')

  const frameCount = Math.max(1, Math.round(durationSec * fps))
  const estBytes = estimateFseqBytes(pixelCount, frameCount)
  const estMb = estBytes / 1024 / 1024
  if (estMb > 512) {
    warnings.push(`Estimated sequence size ~${estMb.toFixed(0)} MB — large for FPP storage.`)
  } else if (estMb > 100) {
    warnings.push(`Estimated sequence size ~${estMb.toFixed(1)} MB.`)
  }

  for (const node of graph.nodes) {
    if (LIVE_INPUT_TYPES.has(node.type)) {
      warnings.push(
        `“${node.label ?? node.type}” uses live input — bake captures a single snapshot only.`
      )
      break
    }
  }

  warnings.push(
    'Baked sequences are offline animations. Video/image nodes use the current frame for the entire bake.'
  )
  warnings.push(
    'Map FPP channel outputs to start at channel 1 (or your universe offset) — file channels are RGB in patch order.'
  )

  if (seamlessLoop && loopPeriodSec === null) {
    warnings.push(
      'Seamless loop is on but no loop period was detected — export will use your duration and check loop match after bake.'
    )
  }

  warnings.push(...bakeExportWarnings(graph))

  return { canExport: errors.length === 0, errors, warnings }
}
