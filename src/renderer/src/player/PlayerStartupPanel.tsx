import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_PLAYER_STARTUP_CONFIG,
  isStartupConfigReadyForLogin,
  type PlayerStartupConfig
} from '@shared/playerStartup'
import { useEngineStore } from '@/store/engineStore'
import { loadProjectIntoStores } from '@/project/loadProject'

interface LoginItemStatus {
  supported: boolean
  openAtLogin: boolean
  args: string[]
  manualCommand: string
}

interface PlayerStartupPanelProps {
  open: boolean
  onClose: () => void
  onApplied?: (projectName: string) => void
}

export function PlayerStartupPanel({
  open,
  onClose,
  onApplied
}: PlayerStartupPanelProps): React.JSX.Element | null {
  const interfaces = useEngineStore((s) => s.interfaces)
  const loadInterfaces = useEngineStore((s) => s.loadInterfaces)
  const setOutputActive = useEngineStore((s) => s.setOutputActive)

  const [config, setConfig] = useState<PlayerStartupConfig>({ ...DEFAULT_PLAYER_STARTUP_CONFIG })
  const [loginStatus, setLoginStatus] = useState<LoginItemStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const refreshLoginStatus = useCallback(async (): Promise<void> => {
    if (window.pixelforgePlayer === undefined) return
    const status = await window.pixelforgePlayer.getLoginItemStatus()
    setLoginStatus(status)
  }, [])

  const loadConfig = useCallback(async (): Promise<void> => {
    if (window.pixelforgePlayer === undefined) return
    const next = await window.pixelforgePlayer.getStartupConfig()
    setConfig(next)
    await refreshLoginStatus()
  }, [refreshLoginStatus])

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaved(false)
    void loadInterfaces()
    void loadConfig()
  }, [open, loadConfig, loadInterfaces])

  if (!open) return null

  const loginReady = isStartupConfigReadyForLogin(config)

  const pickShow = async (): Promise<void> => {
    if (window.pixelforgePlayer === undefined) return
    setError(null)
    try {
      const picked = await window.pixelforgePlayer.pickShow()
      if (picked === null) return
      let next: PlayerStartupConfig = {
        ...config,
        showPath: picked.path,
        showPathKind: picked.kind
      }
      if (picked.kind === 'show-folder') {
        const hints = await window.pixelforgePlayer.readShowHints(picked.path)
        if (hints !== null) {
          next = {
            ...next,
            interface: hints.interface !== undefined ? hints.interface ?? null : next.interface,
            autoOutput: hints.autoOutput ?? next.autoOutput,
            headless: hints.headless !== undefined ? hints.headless : next.headless
          }
        }
      }
      setConfig(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pick show')
    }
  }

  const save = async (): Promise<void> => {
    if (window.pixelforgePlayer === undefined) return
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const result = await window.pixelforgePlayer.setStartupConfig(config)
      if (!result.ok) {
        setError(result.error ?? 'Failed to save')
        return
      }
      setSaved(true)
      await refreshLoginStatus()
    } finally {
      setBusy(false)
    }
  }

  const applyNow = async (): Promise<void> => {
    if (window.pixelforgePlayer === undefined) return
    setBusy(true)
    setError(null)
    try {
      const saveResult = await window.pixelforgePlayer.setStartupConfig(config)
      if (!saveResult.ok) {
        setError(saveResult.error ?? 'Failed to save startup settings')
        return
      }
      const result = await window.pixelforgePlayer.applyStartupNow()
      if (!result.ok || result.project === undefined) {
        setError(result.error ?? 'Failed to apply startup show')
        return
      }
      loadProjectIntoStores(result.project)
      if (config.autoOutput) setOutputActive(true)
      onApplied?.(result.project.meta.name)
      await refreshLoginStatus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="about-overlay" onClick={onClose}>
      <div
        className="about-card startup-panel"
        role="dialog"
        aria-labelledby="startup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="startup-title">Startup Show</h2>
        <p className="panel-hint">
          Load a show automatically when Player opens or at system login. Choose windowed or headless
          before enabling launch at login.
        </p>

        <div className="startup-field">
          <label className="startup-label">Show</label>
          <div className="startup-row">
            <span className="startup-path">{config.showPath ?? 'No show selected'}</span>
            <button className="tool-btn" type="button" onClick={() => void pickShow()} disabled={busy}>
              Browse…
            </button>
          </div>
        </div>

        <div className="startup-field">
          <label className="startup-label">Network interface</label>
          <select
            className="startup-select"
            value={config.interface ?? ''}
            onChange={(e) =>
              setConfig({ ...config, interface: e.target.value === '' ? null : e.target.value })
            }
          >
            <option value="">System default</option>
            {interfaces
              .filter((i) => !i.internal)
              .map((iface) => (
                <option key={`${iface.name}-${iface.address}`} value={iface.address}>
                  {iface.name} ({iface.address})
                </option>
              ))}
          </select>
        </div>

        <label className="startup-check">
          <input
            type="checkbox"
            checked={config.autoOutput}
            onChange={(e) => setConfig({ ...config, autoOutput: e.target.checked })}
          />
          Auto-start output when show loads
        </label>

        <fieldset className="startup-fieldset">
          <legend className="startup-label">Run mode</legend>
          <label className="startup-radio">
            <input
              type="radio"
              name="headless"
              checked={config.headless === null}
              onChange={() => setConfig({ ...config, headless: null })}
            />
            Not set
          </label>
          <label className="startup-radio">
            <input
              type="radio"
              name="headless"
              checked={config.headless === false}
              onChange={() => setConfig({ ...config, headless: false })}
            />
            Windowed Player
          </label>
          <label className="startup-radio">
            <input
              type="radio"
              name="headless"
              checked={config.headless === true}
              onChange={() => setConfig({ ...config, headless: true })}
            />
            Headless (no window)
          </label>
        </fieldset>

        <label className={`startup-check ${!loginReady ? 'disabled' : ''}`}>
          <input
            type="checkbox"
            checked={config.launchAtLogin}
            disabled={!loginReady}
            onChange={(e) => setConfig({ ...config, launchAtLogin: e.target.checked })}
          />
          Launch at login
        </label>

        {loginStatus !== null && (
          <p className="startup-status">
            {loginStatus.supported
              ? loginStatus.openAtLogin
                ? 'Registered to launch at login.'
                : config.launchAtLogin
                  ? 'Launch at login will apply after you save.'
                  : 'Not registered at login.'
              : 'Automatic login registration is not supported on this platform. Use the command below in your autostart setup.'}
          </p>
        )}

        {loginStatus !== null && !loginStatus.supported && loginReady && (
          <pre className="startup-command">{loginStatus.manualCommand}</pre>
        )}

        {error !== null && <p className="startup-error">{error}</p>}
        {saved && <p className="startup-success">Settings saved.</p>}

        <div className="about-actions">
          <button className="tool-btn" type="button" onClick={() => void applyNow()} disabled={busy || !loginReady}>
            Apply now
          </button>
          <button className="tool-btn primary" type="button" onClick={() => void save()} disabled={busy}>
            Save
          </button>
          <button className="tool-btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
