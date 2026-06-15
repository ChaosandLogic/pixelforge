import { useCallback, useEffect, useState } from 'react'
import type { LicenseProduct, LicenseStatus } from '@shared/licensing/types'
import { isLicenseUsable } from '@shared/licensing/verify'
import { APP_EDITOR_NAME, APP_PLAYER_NAME } from '@shared/appInfo'

type LicenseApiKind = 'editor' | 'player'

async function fetchStatus(api: LicenseApiKind): Promise<LicenseStatus> {
  if (api === 'editor') return window.pixelforge.getLicenseStatus()
  return window.pixelforgePlayer!.getLicenseStatus()
}

async function deactivate(api: LicenseApiKind): Promise<void> {
  if (api === 'editor') return window.pixelforge.deactivateLicense()
  return window.pixelforgePlayer!.deactivateLicense()
}

function formatState(state: LicenseStatus['state']): string {
  return state.replace(/_/g, ' ')
}

interface LicenseDialogProps {
  product: LicenseProduct
  api: LicenseApiKind
  open: boolean
  onClose: () => void
}

export function LicenseDialog({ product, api, open, onClose }: LicenseDialogProps): React.JSX.Element | null {
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setStatus(await fetchStatus(api))
  }, [api])

  useEffect(() => {
    if (!open) return
    void refresh()
  }, [open, refresh])

  if (!open) return null

  const title = product === 'editor' ? APP_EDITOR_NAME : APP_PLAYER_NAME
  const usable = status !== null && isLicenseUsable(status.state)

  const onDeactivate = async (): Promise<void> => {
    setBusy(true)
    try {
      await deactivate(api)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="about-overlay" onClick={onClose}>
      <div
        className="about-card license-dialog"
        role="dialog"
        aria-labelledby="license-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="license-title">License — {title}</h2>

        {status === null ? (
          <p className="panel-hint">Loading license…</p>
        ) : (
          <>
            <dl className="license-detail-list">
              <div>
                <dt>Status</dt>
                <dd className={usable ? 'license-ok' : 'license-bad'}>{formatState(status.state)}</dd>
              </div>
              {status.licenseKey !== null && (
                <div>
                  <dt>License key</dt>
                  <dd>{status.licenseKey}</dd>
                </div>
              )}
              {status.email !== null && (
                <div>
                  <dt>Email</dt>
                  <dd>{status.email}</dd>
                </div>
              )}
              {product === 'editor' && status.slotsTotal !== null && (
                <div>
                  <dt>Player slots</dt>
                  <dd>
                    {status.slotsUsed ?? 0} of {status.slotsTotal} in use
                  </dd>
                </div>
              )}
              {status.lastOnlineCheck !== null && (
                <div>
                  <dt>Last verified</dt>
                  <dd>{new Date(status.lastOnlineCheck).toLocaleString()}</dd>
                </div>
              )}
              {status.expiresAt !== null && (
                <div>
                  <dt>Expires</dt>
                  <dd>{new Date(status.expiresAt).toLocaleDateString()}</dd>
                </div>
              )}
              <div>
                <dt>Offline grace</dt>
                <dd>{status.graceOfflineDays} days without verification</dd>
              </div>
            </dl>

            {status.message !== null && <p className="license-message">{status.message}</p>}

            {!usable && (
              <p className="about-footnote">
                {product === 'editor'
                  ? 'Enter your license key on the activation screen to unlock the Editor.'
                  : 'Activate with your Editor license key. Each Player install uses one slot from your pool.'}
              </p>
            )}
          </>
        )}

        <div className="about-actions license-dialog-actions">
          {status !== null && usable && (
            <button className="tool-btn" disabled={busy} onClick={() => void onDeactivate()}>
              {busy ? 'Deactivating…' : 'Deactivate this machine'}
            </button>
          )}
          <button className="tool-btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
