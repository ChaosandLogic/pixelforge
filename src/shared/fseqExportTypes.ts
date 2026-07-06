export const FSEQ_EXPORT_MANIFEST_VERSION = '1.0.0'

export interface FseqExportManifest {
  version: typeof FSEQ_EXPORT_MANIFEST_VERSION
  name: string
  exportedAt: string
  format: 'FSEQ'
  sequenceFile: string
  channelCount: number
  pixelCount: number
  frameCount: number
  fps: number
  stepTimeMs: number
  durationSec: number
  fileSize: number
  player: {
    name: 'Falcon Player'
    note: string
  }
}

export interface FseqExportPayload {
  name: string
  sequenceFilename: string
  pixelCount: number
  channelCount: number
  frameCount: number
  fps: number
  stepTimeMs: number
  durationSec: number
  /** FSEQ v2 uncompressed sequence binary. */
  sequenceData: Uint8Array
}

export interface FseqExportResult {
  outputDir: string
  manifest: FseqExportManifest
}
