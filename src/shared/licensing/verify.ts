import {
  DEFAULT_GRACE_OFFLINE_DAYS,
  type LicenseState,
  type LicenseStatus,
  type LicenseProduct,
  type StoredLicense
} from './types'

export function evaluateLicense(
  license: StoredLicense | null,
  machineId: string,
  product: LicenseProduct,
  options?: { signatureValid?: boolean; now?: Date }
): LicenseStatus {
  const now = options?.now ?? new Date()
  const signatureValid = options?.signatureValid ?? true

  if (license === null) {
    return {
      state: 'missing',
      product,
      licenseKey: null,
      email: null,
      activationId: null,
      playerSlots: null,
      slotsUsed: null,
      slotsTotal: null,
      expiresAt: null,
      lastOnlineCheck: null,
      graceOfflineDays: DEFAULT_GRACE_OFFLINE_DAYS,
      message: 'No license activated'
    }
  }

  const base = {
    product,
    licenseKey: license.payload.licenseKey,
    email: license.payload.email,
    activationId: license.payload.activationId,
    playerSlots: license.payload.playerSlots ?? null,
    slotsUsed: null,
    slotsTotal: license.payload.playerSlots ?? null,
    expiresAt: license.payload.expiresAt ?? null,
    lastOnlineCheck: license.lastOnlineCheck,
    graceOfflineDays: license.payload.graceOfflineDays
  }

  if (license.payload.product !== product) {
    return { ...base, state: 'invalid', message: `License is for ${license.payload.product}, not ${product}` }
  }

  if (!signatureValid) {
    return { ...base, state: 'invalid', message: 'License signature is invalid' }
  }

  if (license.payload.machineId !== machineId) {
    return { ...base, state: 'machine_mismatch', message: 'License is bound to another machine' }
  }

  if (license.payload.expiresAt !== undefined) {
    const expires = new Date(license.payload.expiresAt)
    if (now > expires) {
      return { ...base, state: 'expired', message: 'License has expired' }
    }
  }

  const lastCheck = new Date(license.lastOnlineCheck)
  const graceMs = license.payload.graceOfflineDays * 24 * 60 * 60 * 1000

  const msSinceCheck = now.getTime() - lastCheck.getTime()
  if (msSinceCheck > graceMs) {
    return {
      ...base,
      state: 'grace_expired',
      message: 'Connect to the internet to verify your license'
    }
  }
  if (msSinceCheck < 60 * 60 * 1000) {
    return { ...base, state: 'valid', message: null }
  }
  return {
    ...base,
    state: 'offline_grace',
    message: 'Running in offline grace period'
  }
}

export function isLicenseUsable(state: LicenseState): boolean {
  return state === 'valid' || state === 'offline_grace'
}
