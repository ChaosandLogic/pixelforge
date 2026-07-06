export const ESP_EXPORT_MANIFEST_VERSION = '1.0.0'

export interface EspExportManifest {
  version: typeof ESP_EXPORT_MANIFEST_VERSION
  name: string
  exportedAt: string
  format: 'ALED'
  showFile: string
  ledCount: number
  frameCount: number
  fps: number
  durationSec: number
  fileSize: number
  firmware: {
    name: 'ESPixel'
    note: string
  }
}

export interface EspExportPayload {
  name: string
  showFilename: string
  ledCount: number
  frameCount: number
  fps: number
  durationSec: number
  /** ALED-encoded show binary. */
  showData: Uint8Array
}

export interface EspExportResult {
  outputDir: string
  manifest: EspExportManifest
}
