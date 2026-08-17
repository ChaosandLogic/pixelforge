import { OUTPUT_NODE_TYPE } from '../graph/nodes'
import { AUDIO_IN_NODE_TYPE } from '../graph/nodes/audio/AudioIn'
import { KEYBOARD_IN_NODE_TYPE } from '../graph/nodes/input/KeyboardIn'
import { MIDI_IN_NODE_TYPE } from '../graph/nodes/input/MidiIn'
import { OSC_IN_NODE_TYPE } from '../graph/nodes/input/OscIn'
import { SYPHON_IN_NODE_TYPE } from '../graph/nodes/generators/SyphonIn'
import type { GraphData } from '../graph/types'
import { ESP_MAX_LEDS, estimateAledMaxBytes } from './aled'
import { bakeExportWarnings } from './loopPeriod'

const LIVE_INPUT_TYPES = new Set([
  AUDIO_IN_NODE_TYPE,
  MIDI_IN_NODE_TYPE,
  KEYBOARD_IN_NODE_TYPE,
  OSC_IN_NODE_TYPE,
  SYPHON_IN_NODE_TYPE
])

export interface EspPreflightResult {
  canExport: boolean
  errors: string[]
  warnings: string[]
}

export function espExportPreflight(
  graph: GraphData,
  pixelCount: number,
  durationSec: number,
  fps: number,
  graphError: string | null,
  seamlessLoop = false,
  loopPeriodSec: number | null = null
): EspPreflightResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (graphError !== null) errors.push(graphError)
  if (pixelCount <= 0) errors.push('Patch has no pixels configured.')
  if (pixelCount > ESP_MAX_LEDS) {
    errors.push(`Patch has ${pixelCount} pixels; ESPixel supports at most ${ESP_MAX_LEDS}.`)
  }

  const hasOutput = graph.nodes.some((n) => n.type === OUTPUT_NODE_TYPE)
  if (!hasOutput) errors.push('Graph needs a Pixel Output node to bake.')

  const frameCount = Math.max(1, Math.round(durationSec * fps))
  const estBytes = estimateAledMaxBytes(pixelCount, frameCount)
  if (estBytes > 1.5 * 1024 * 1024) {
    warnings.push(
      `Estimated show size up to ${(estBytes / 1024 / 1024).toFixed(1)} MB — may exceed ESPixel SPIFFS.`
    )
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
    'Baked shows are offline animations. Video/image nodes use the current frame for the entire bake.'
  )

  if (seamlessLoop && loopPeriodSec === null) {
    warnings.push(
      'Seamless loop is on but no loop period was detected — export will use your duration and check loop match after bake.'
    )
  }

  warnings.push(...bakeExportWarnings(graph))

  return { canExport: errors.length === 0, errors, warnings }
}
