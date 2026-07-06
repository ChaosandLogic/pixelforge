import { useState } from 'react'
import { encodeFseq, fpsFromStepTime, validateFseqExport } from '@shared/export/fseq'
import { fseqExportPreflight } from '@shared/export/fseqPreflight'
import { measureLoopSeam, formatLoopSeam } from '@shared/export/loopSeam'
import { usePatchStore } from '@/store/patchStore'
import { ExportBakeFields } from './ExportBakeFields'
import { useExportBakeFlow } from './useExportBakeFlow'

interface ExportFseqDialogProps {
  open: boolean
  onClose: () => void
}

export function ExportFseqDialog({ open, onClose }: ExportFseqDialogProps): React.JSX.Element | null {
  const [sequenceFilename, setSequenceFilename] = useState('show.fseq')
  const layout = usePatchStore((s) => s.layout)
  const flow = useExportBakeFlow(fseqExportPreflight)

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

    flow.setStatus(`Encoding FSEQ… (${seamLabel})`)
    try {
      const encoded = encodeFseq({
        frames: bakeResult.frames,
        frameCount: bakeResult.frameCount,
        pixelCount: bakeResult.pixelCount,
        fps: bakeResult.fps
      })
      if (encoded.error !== null) {
        alert(`Encode failed: ${encoded.error}`)
        return
      }

      const validation = validateFseqExport(
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

      const filename =
        sequenceFilename.trim() === '' ? 'show.fseq' : sequenceFilename.trim()
      flow.setStatus('Writing export folder…')
      const result = await window.pixelforge.exportFseq({
        name: layout?.fixtures[0]?.name ?? 'PixelForge Show',
        sequenceFilename: filename.endsWith('.fseq') ? filename : `${filename}.fseq`,
        pixelCount: bakeResult.pixelCount,
        channelCount: encoded.channelCount,
        frameCount: encoded.frameCount,
        fps: bakeResult.fps,
        stepTimeMs: encoded.stepTimeMs,
        durationSec: flow.loopBake.bakeDurationSec,
        sequenceData: encoded.data
      })

      if (result !== null) {
        const effectiveFps = fpsFromStepTime(encoded.stepTimeMs).toFixed(1)
        alert(
          `FSEQ export written to ${result.outputDir}\n${seamLabel}\nStep time: ${encoded.stepTimeMs} ms (~${effectiveFps} fps)`
        )
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
        aria-labelledby="export-fseq-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="export-fseq-title">Export for Falcon Player (FSEQ)</h2>
        <p className="panel-hint">
          Bakes the current graph to an uncompressed FSEQ v2 file for Falcon Player (FPP) or
          xLights-compatible players. Copy the <code>.fseq</code> to your FPP sequences folder and
          map channel outputs to your pixels.
        </p>

        <ExportBakeFields
          flow={flow}
          filenameField={
            <label className="param-row">
              <span>Sequence filename</span>
              <input
                type="text"
                value={sequenceFilename}
                disabled={flow.busy}
                onChange={(e) => setSequenceFilename(e.target.value)}
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
