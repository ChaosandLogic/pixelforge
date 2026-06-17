import { useState } from 'react'
import type { ShowStartupHints } from '@shared/playerStartup'

interface ExportShowDialogProps {
  open: boolean
  interfaceAddress: string | null
  onClose: () => void
  onConfirm: (startup: ShowStartupHints) => void
}

export function ExportShowDialog({
  open,
  interfaceAddress,
  onClose,
  onConfirm
}: ExportShowDialogProps): React.JSX.Element | null {
  const [autoOutput, setAutoOutput] = useState(true)
  const [headless, setHeadless] = useState(false)

  if (!open) return null

  return (
    <div className="about-overlay" onClick={onClose}>
      <div
        className="about-card startup-panel"
        role="dialog"
        aria-labelledby="export-show-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="export-show-title">Export Show</h2>
        <p className="panel-hint">
          Optional startup hints are saved in show.json. Player uses them to prefill Startup Show settings
          when this folder is selected on site.
        </p>

        <label className="startup-check">
          <input type="checkbox" checked={autoOutput} onChange={(e) => setAutoOutput(e.target.checked)} />
          Suggest auto-start output
        </label>

        <label className="startup-check">
          <input type="checkbox" checked={headless} onChange={(e) => setHeadless(e.target.checked)} />
          Suggest headless (rack) mode
        </label>

        <p className="panel-hint">
          Network interface hint: {interfaceAddress ?? 'system default'}
        </p>

        <div className="about-actions">
          <button
            className="tool-btn primary"
            type="button"
            onClick={() => {
              onConfirm({
                interface: interfaceAddress,
                autoOutput,
                headless
              })
              onClose()
            }}
          >
            Choose folder…
          </button>
          <button className="tool-btn" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
