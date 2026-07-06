import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  ESP_EXPORT_MANIFEST_VERSION,
  type EspExportManifest,
  type EspExportPayload,
  type EspExportResult
} from '@shared/espExportTypes'

function buildReadme(manifest: EspExportManifest): string {
  return `# ${manifest.name} — ESPixel playback

This folder contains a baked LED animation for [ESPixel](https://github.com/) firmware.

## Files

- \`${manifest.showFile}\` — ALED animation (${manifest.ledCount} LEDs, ${manifest.frameCount} frames @ ${manifest.fps} fps)
- \`esp-manifest.json\` — export metadata

## 1. Flash ESPixel firmware

In your ESPixel project directory:

\`\`\`bash
pio run -t upload
pio run -t uploadfs
\`\`\`

This flashes the application and the web UI to SPIFFS.

## 2. Connect to the device

- Join the ESPixel WiFi access point (default SSID is often \`ESPixel-AP\`), or
- Connect to the same network as the device and open its IP address in a browser.

## 3. Configure LEDs

In the web UI **Hardware** page, set:

- **Number of LEDs** to **${manifest.ledCount}** (must match this export)
- Data pin, color order, and brightness for your strip

## 4. Upload the show

Upload \`${manifest.showFile}\` via the web UI file upload, or:

\`\`\`bash
curl -F "file=@${manifest.showFile}" http://<device-ip>/api/upload
\`\`\`

## 5. Start playback

In the web UI, select the file and start playback, or:

\`\`\`bash
curl -X POST http://<device-ip>/api/playback \\
  -H "Content-Type: application/json" \\
  -d '{"action":"start","filename":"/${manifest.showFile}"}'
\`\`\`

## Notes

- LED index order in the file matches your PixelForge patch wiring order.
- Baked shows do not support live audio, MIDI, or OSC — use sACN streaming from PixelForge Player for interactive shows.
`
}

export async function exportEspBundle(
  outputDir: string,
  payload: EspExportPayload
): Promise<EspExportResult> {
  await mkdir(outputDir, { recursive: true })

  const showPath = join(outputDir, payload.showFilename)
  await writeFile(showPath, payload.showData)

  const manifest: EspExportManifest = {
    version: ESP_EXPORT_MANIFEST_VERSION,
    name: payload.name,
    exportedAt: new Date().toISOString(),
    format: 'ALED',
    showFile: payload.showFilename,
    ledCount: payload.ledCount,
    frameCount: payload.frameCount,
    fps: payload.fps,
    durationSec: payload.durationSec,
    fileSize: payload.showData.byteLength,
    firmware: {
      name: 'ESPixel',
      note: 'Flash firmware and SPIFFS from your ESPixel repository (PlatformIO).'
    }
  }

  await writeFile(join(outputDir, 'esp-manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
  await writeFile(join(outputDir, 'README.md'), buildReadme(manifest), 'utf-8')

  return { outputDir, manifest }
}
