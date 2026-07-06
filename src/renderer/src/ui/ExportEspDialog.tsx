import { useState } from 'react'
import { encodeAled, validateEspExport } from '@shared/export/aled'
import { espExportPreflight } from '@shared/export/espPreflight'
import { formatLoopSeam, measureLoopSeam } from '@shared/export/loopSeam'
import { usePatchStore } from '@/store/patchStore'
import { ExportBakeFields } from './ExportBakeFields'
import { useExportBakeFlow } from './useExportBakeFlow'

interface ExportEspDialogProps {
  open: boolean
  onClose: () => void
}

export function ExportEspDialog({ open, onClose }: ExportEspDialogProps): React.JSX.Element | null {
  const [showFilename, setShowFilename] = useState('show.bin')
  const layout = usePatchStore((s) => s.layout)
  const flow = useExportBakeFlow(espExportPreflight)

  if (!open) return null

  const runExport = async (): Promise<void> => {
    const bakeResult = await flow.runBake()
    if (bakeResult === null) return

    const seam = measureLoopSeam(
      bakeResult.frames,
      bakeResult.frameCount,
      bakeResult.pixelCount,
      bakeResult.seamFrame
    )
    const seamLabel = formatLoopSeam(seam)

    flow.setStatus(`Encoding ALED show… (${seamLabel})`)
    try {
      const encoded = encodeAled({
        frames: bakeResult.frames,
        frameCount: bakeResult.frameCount,
        pixelCount: bakeResult.pixelCount,
        fps: bakeResult.fps
      })
      if (encoded.error !== null) {
        alert(`Encode failed: ${encoded.error}`)
        return
      }

      const validation = validateEspExport(
        bakeResult.pixelCount,
        bakeResult.frameCount,
        bakeResult.fps,
        encoded.data.byteLength
      )
      if (!validation.ok) {
        alert(validation.errors.join('\n'))
        return
      }
      if (validation.warnings.length > 0) {
        const proceed = window.confirm(
          `${validation.warnings.join('\n\n')}\n\nContinue export?`
        )
        if (!proceed) return
      }

      const filename = showFilename.trim() === '' ? 'show.bin' : showFilename.trim()
      flow.setStatus('Writing export folder…')
      const result = await window.pixelforge.exportEsp({
        name: layout?.fixtures[0]?.name ?? 'PixelForge Show',
        showFilename: filename.endsWith('.bin') ? filename : `${filename}.bin`,
        ledCount: encoded.ledCount,
        frameCount: encoded.frameCount,
        fps: encoded.fps,
        durationSec: flow.loopBake.bakeDurationSec,
        showData: encoded.data
      })

      if (result !== null) {
        alert(`ESP export written to ${result.outputDir}\n${seamLabel}`)
        onClose()
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      flow.setStatus(null)
    }
  }

  return (
    <div className="about-overlay" onClick={flow.busy ? undefined : onClose}>
      <div
        className="about-card startup-panel"
        role="dialog"
        aria-labelledby="export-esp-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="export-esp-title">Export for ESP32 (ESPixel)</h2>
        <p className="panel-hint">
          Bakes the current graph to an ALED <code>.bin</code> for ESPixel firmware playback. Flash
          firmware from your ESPixel repo, then upload the show file via the device web UI.
        </p>

        <ExportBakeFields
          flow={flow}
          filenameField={
            <label className="param-row">
              <span>Show filename</span>
              <input
                type="text"
                value={showFilename}
                disabled={flow.busy}
                onChange={(e) => setShowFilename(e.target.value)}
              />
            </label>
          }
        />

        {flow.status !== null && <p className="panel-hint">{flow.status}</p>}

        <div className="about-actions">
          <button
            className="tool-btn primary"
            type="button"
            disabled={!flow.preflight.canExport || flow.busy}
            onClick={() => void runExport()}
          >
            {flow.busy ? 'Exporting…' : 'Choose folder…'}
          </button>
          <button className="tool-btn" type="button" disabled={flow.busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
