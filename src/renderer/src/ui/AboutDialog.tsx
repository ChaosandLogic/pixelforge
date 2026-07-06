import { useEffect, useState } from 'react'
import {
  APP_ABOUT_LINES,
  APP_COPYRIGHT,
  APP_EDITOR_NAME,
  APP_NAME,
  APP_PLAYER_NAME,
  APP_TAGLINE,
  KEYBOARD_SHORTCUTS
} from '@shared/appInfo'

type AboutMode = 'about' | 'shortcuts' | null

interface AboutDialogProps {
  product: 'editor' | 'player'
  mode: AboutMode
  onClose: () => void
}

export function AboutDialog({ product, mode, onClose }: AboutDialogProps): React.JSX.Element | null {
  const [version, setVersion] = useState('…')

  useEffect(() => {
    if (mode === null) return
    const getVersion =
      product === 'editor'
        ? window.pixelforge.getAppVersion()
        : window.pixelforgePlayer!.getAppVersion()
    void getVersion.then(setVersion)
  }, [mode, product])

  if (mode === null) return null

  const title = product === 'editor' ? APP_EDITOR_NAME : APP_PLAYER_NAME

  return (
    <div className="about-overlay" onClick={onClose}>
      <div
        className="about-card"
        role="dialog"
        aria-labelledby="about-title"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'about' ? (
          <>
            <div className="about-header">
              <span className="brand-mark about-mark" />
              <div>
                <h2 id="about-title">{title}</h2>
                <p className="about-version">Version {version}</p>
              </div>
            </div>
            <p className="about-tagline">{APP_TAGLINE}</p>
            <ul className="about-list">
              {APP_ABOUT_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="about-footnote">
              {product === 'editor'
                ? `Author shows in ${APP_NAME} Editor and deploy them on site with ${APP_PLAYER_NAME}.`
                : `${APP_PLAYER_NAME} runs exported shows on site.`}
            </p>
            <p className="about-copyright">{APP_COPYRIGHT}</p>
          </>
        ) : (
          <>
            <h2 id="about-title">Keyboard shortcuts</h2>
            <dl className="shortcut-list">
              {KEYBOARD_SHORTCUTS.map(({ keys, action }) => (
                <div key={keys}>
                  <dt>{keys}</dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        <div className="about-actions">
          <button className="tool-btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
