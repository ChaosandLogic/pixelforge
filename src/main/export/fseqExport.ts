import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  FSEQ_EXPORT_MANIFEST_VERSION,
  type FseqExportManifest,
  type FseqExportPayload,
  type FseqExportResult
} from '@shared/fseqExportTypes'

function buildReadme(manifest: FseqExportManifest): string {
  const channelsPerPixel =
    manifest.pixelCount > 0 ? manifest.channelCount / manifest.pixelCount : 3
  const colour = channelsPerPixel === 4 ? 'RGBW' : 'RGB'
  const firstPixelChannels = channelsPerPixel === 4 ? 'four' : 'three'
  return `# ${manifest.name} — Falcon Player (FPP)

This folder contains a baked LED sequence for [Falcon Player](https://github.com/FalconChristmas/fpp).

## Files

- \`${manifest.sequenceFile}\` — FSEQ v2 sequence (${manifest.pixelCount} pixels / ${manifest.channelCount} channels, ${manifest.frameCount} frames @ ${manifest.stepTimeMs} ms)
- \`fseq-manifest.json\` — export metadata

## 1. Copy to FPP

Copy \`${manifest.sequenceFile}\` to your FPP sequences folder, for example:

\`\`\`bash
scp ${manifest.sequenceFile} fpp:/home/pi/media/sequences/
\`\`\`

Or upload via **Content Manager → File Manager** in the FPP web UI.

## 2. Configure channel outputs

In FPP **Channel Outputs**, map a pixel protocol output (e.g. WS2811) so that:

- **Start channel** matches where this sequence begins in your show (often channel **1**)
- **Channel count** is at least **${manifest.channelCount}** (${manifest.pixelCount} ${colour} pixels)
- **Color order** matches your strip (${colour} unless your hardware expects a different order)

Channel data in the file is **${colour} interleaved in PixelForge patch wiring order** (pixel 0 = first ${firstPixelChannels} channels).

## 3. Play the sequence

Create or edit a playlist in FPP and add this sequence, or play it directly from **Status → Playlists**.

Enable **Loop** on the playlist item if you want continuous playback.

## Notes

- Step time is **${manifest.stepTimeMs} ms** per frame (~${(1000 / manifest.stepTimeMs).toFixed(1)} fps).
- Baked sequences do not support live audio, MIDI, OSC, or Syphon/Spout — use sACN streaming from PixelForge Player for interactive shows.
`
}

export async function exportFseqBundle(
  outputDir: string,
  payload: FseqExportPayload
): Promise<FseqExportResult> {
  await mkdir(outputDir, { recursive: true })

  const sequencePath = join(outputDir, payload.sequenceFilename)
  await writeFile(sequencePath, payload.sequenceData)

  const manifest: FseqExportManifest = {
    version: FSEQ_EXPORT_MANIFEST_VERSION,
    name: payload.name,
    exportedAt: new Date().toISOString(),
    format: 'FSEQ',
    sequenceFile: payload.sequenceFilename,
    channelCount: payload.channelCount,
    pixelCount: payload.pixelCount,
    frameCount: payload.frameCount,
    fps: payload.fps,
    stepTimeMs: payload.stepTimeMs,
    durationSec: payload.durationSec,
    fileSize: payload.sequenceData.byteLength,
    player: {
      name: 'Falcon Player',
      note: 'Copy the .fseq file to FPP and map channel outputs to your pixel controller.'
    }
  }

  await writeFile(join(outputDir, 'fseq-manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
  await writeFile(join(outputDir, 'README.md'), buildReadme(manifest), 'utf-8')

  return { outputDir, manifest }
}
