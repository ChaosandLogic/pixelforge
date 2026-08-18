import type { ReactNode } from 'react'
import { MAX_BAKE_FPS } from '@shared/messages'
import { parseOutputConfig } from '@shared/output/config'
import { COLOR_MODE_LABELS, channelsPerPixel } from '@shared/output/rgbw'
import { formatLoopPeriodSec, type ExportBakeFlow } from './useExportBakeFlow'

interface ExportBakeFieldsProps {
  flow: ExportBakeFlow
  filenameField: ReactNode
  extraHints?: ReactNode
}

/** Shared duration, loop, and preflight fields for FSEQ / ESP export dialogs. */
export function ExportBakeFields({
  flow,
  filenameField,
  extraHints
}: ExportBakeFieldsProps): React.JSX.Element {
  const {
    durationSec,
    setDurationSec,
    fps,
    setFps,
    seamlessLoop,
    setSeamlessLoop,
    periodMode,
    setPeriodMode,
    manualPeriodSec,
    setManualPeriodSec,
    busy,
    loopBake,
    activePeriodSec,
    detectedPeriod,
    preflight,
    pixelCount,
    graph
  } = flow
  const colorMode = parseOutputConfig(graph).colorMode
  const cpp = channelsPerPixel(colorMode)

  return (
    <>
      <label className="param-row">
        <span>Duration (seconds)</span>
        <input
          type="number"
          min={1}
          max={3600}
          step={1}
          value={durationSec}
          disabled={busy}
          onChange={(e) => setDurationSec(Math.max(1, Number(e.target.value) || 1))}
        />
      </label>

      {seamlessLoop && loopBake.snapped && (
        <p className="panel-hint">
          Seamless loop: baking {loopBake.bakeDurationSec.toFixed(2)} s (
          {Math.round(loopBake.bakeDurationSec / (loopBake.periodSec ?? 1))}× loop period)
        </p>
      )}

      <label className="param-row">
        <span>Seamless loop</span>
        <input
          type="checkbox"
          checked={seamlessLoop}
          disabled={busy}
          onChange={(e) => setSeamlessLoop(e.target.checked)}
        />
      </label>

      {seamlessLoop && (
        <>
          <label className="param-row">
            <span>Loop period</span>
            <select
              value={periodMode}
              disabled={busy}
              onChange={(e) => setPeriodMode(e.target.value as 'auto' | 'manual')}
            >
              <option value="auto">Auto from graph</option>
              <option value="manual">Manual (seconds)</option>
            </select>
          </label>

          {periodMode === 'manual' ? (
            <label className="param-row">
              <span>Period (seconds)</span>
              <input
                type="number"
                min={0.05}
                max={3600}
                step={0.01}
                value={manualPeriodSec}
                disabled={busy}
                onChange={(e) => setManualPeriodSec(Math.max(0.05, Number(e.target.value) || 0.05))}
              />
            </label>
          ) : activePeriodSec !== null ? (
            <p className="panel-hint">
              Detected loop period: {formatLoopPeriodSec(activePeriodSec)}
              {detectedPeriod.sources.length > 0 && <> ({detectedPeriod.sources.join(', ')})</>}
            </p>
          ) : (
            <p className="panel-hint">
              No loop period detected — duration will be used as-is. Loop quality is checked after bake.
            </p>
          )}
        </>
      )}

      <label className="param-row">
        <span>FPS</span>
        <input
          type="number"
          min={4}
          max={MAX_BAKE_FPS}
          step={1}
          value={fps}
          disabled={busy}
          onChange={(e) => setFps(Math.max(4, Math.min(MAX_BAKE_FPS, Number(e.target.value) || 4)))}
        />
      </label>

      {filenameField}

      {extraHints}

      <p className="panel-hint">
        Patch: {pixelCount} pixels (baked as RGB
        {colorMode === 'rgbw'
          ? `; FSEQ expands to ${pixelCount * cpp} ${COLOR_MODE_LABELS[colorMode]} channels. ESP export stays RGB.`
          : `, ${pixelCount * cpp} channels in wiring order`}
        )
      </p>

      {preflight.errors.length > 0 && (
        <div className="panel-hint" style={{ color: '#f87171' }}>
          {preflight.errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      {preflight.warnings.length > 0 && (
        <div className="panel-hint">
          {preflight.warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      )}
    </>
  )
}
