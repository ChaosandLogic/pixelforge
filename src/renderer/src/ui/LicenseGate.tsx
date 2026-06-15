import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_GRACE_OFFLINE_DAYS, type LicenseProduct, type LicenseStatus } from '@shared/licensing/types'
import { isLicenseUsable } from '@shared/licensing/verify'

type LicenseApiKind = 'editor' | 'player'

interface LicenseGateProps {
  product: LicenseProduct
  api: LicenseApiKind
  children: React.ReactNode
}

async function fetchStatus(api: LicenseApiKind): Promise<LicenseStatus> {
  if (api === 'editor') return window.pixelforge.getLicenseStatus()
  return window.pixelforgePlayer!.getLicenseStatus()
}

async function activate(api: LicenseApiKind, licenseKey: string, email: string): Promise<LicenseStatus> {
  if (api === 'editor') return window.pixelforge.activateLicense(licenseKey, email)
  return window.pixelforgePlayer!.activateLicense(licenseKey, email)
}

async function deactivate(api: LicenseApiKind): Promise<void> {
  if (api === 'editor') return window.pixelforge.deactivateLicense()
  return window.pixelforgePlayer!.deactivateLicense()
}

export function LicenseGate({ product, api, children }: LicenseGateProps): React.JSX.Element {
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [licenseKey, setLicenseKey] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const next = await fetchStatus(api)
    setStatus(next)
  }, [api])

  useEffect(() => {
    if (api === 'player' && window.pixelforgePlayer === undefined) {
      setStatus({
        state: 'invalid',
        product: 'player',
        licenseKey: null,
        email: null,
        activationId: null,
        playerSlots: null,
        slotsUsed: null,
        slotsTotal: null,
        expiresAt: null,
        lastOnlineCheck: null,
        graceOfflineDays: DEFAULT_GRACE_OFFLINE_DAYS,
        message: 'Player preload failed — restart the app.'
      })
      return
    }
    void refresh()
  }, [api, refresh])

  const onActivate = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const next = await activate(api, licenseKey, email)
      setStatus(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed')
    } finally {
      setBusy(false)
    }
  }

  if (status === null) {
    return (
      <div className="license-gate">
        <p>Checking license…</p>
      </div>
    )
  }

  if (isLicenseUsable(status.state)) {
    return <>{children}</>
  }

  const productLabel = product === 'editor' ? 'PixelForge Editor' : 'PixelForge Player'

  return (
    <div className="license-gate">
      <div className="license-card">
        <h1>{productLabel}</h1>
        <p className="license-lead">
          {product === 'editor'
            ? 'Activate your Editor license to author shows.'
            : 'Activate against your Editor license key. Each Player install uses one slot from your pool.'}
        </p>
        {status.message !== null && <p className="license-message">{status.message}</p>}
        {error !== null && <p className="license-error">{error}</p>}
        <label className="license-field">
          <span>License key</span>
          <input
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="PF-XXXX-XXXX"
            autoComplete="off"
          />
        </label>
        <label className="license-field">
          <span>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
          />
        </label>
        <button className="tool-btn primary" disabled={busy || !licenseKey || !email} onClick={() => void onActivate()}>
          {busy ? 'Activating…' : 'Activate'}
        </button>
        {status.state !== 'missing' && (
          <button className="tool-btn ghost" disabled={busy} onClick={() => void deactivate(api).then(refresh)}>
            Deactivate this machine
          </button>
        )}
      </div>
    </div>
  )
}
