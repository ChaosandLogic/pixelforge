import type { LicenseProduct, LicenseStatus } from './types'
import { isLicenseUsable } from './verify'

const STATE_LABELS: Record<LicenseStatus['state'], string> = {
  valid: 'Licensed',
  offline_grace: 'Offline grace',
  missing: 'No license',
  invalid: 'Invalid license',
  expired: 'Expired',
  machine_mismatch: 'Wrong machine',
  grace_expired: 'Grace expired'
}

function maskLicenseKey(key: string): string {
  if (key.length <= 8) return key
  return `${key.slice(0, 7)}…`
}

export function formatLicenseMenuSummary(status: LicenseStatus, product: LicenseProduct): string {
  const stateLabel = STATE_LABELS[status.state]

  if (!isLicenseUsable(status.state)) {
    return `${stateLabel} — activate in Manage License`
  }

  const parts = [stateLabel]

  if (status.email !== null) {
    parts.push(status.email)
  } else if (status.licenseKey !== null) {
    parts.push(maskLicenseKey(status.licenseKey))
  }

  if (product === 'editor' && status.slotsTotal !== null) {
    parts.push(`${status.slotsUsed ?? 0}/${status.slotsTotal} player slots`)
  }

  return parts.join(' · ')
}
