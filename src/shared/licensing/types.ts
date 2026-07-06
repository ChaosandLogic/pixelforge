export type LicenseProduct = 'editor' | 'player'

export interface LicensePayload {
  product: LicenseProduct
  licenseKey: string
  email: string
  machineId: string
  activationId: string
  playerSlots?: number
  issuedAt: string
  expiresAt?: string
  graceOfflineDays: number
}

export interface StoredLicense {
  payload: LicensePayload
  signature: string
  lastOnlineCheck: string
}

export type LicenseState =
  | 'valid'
  | 'missing'
  | 'invalid'
  | 'expired'
  | 'machine_mismatch'
  | 'offline_grace'
  | 'grace_expired'

export interface LicenseStatus {
  state: LicenseState
  product: LicenseProduct
  licenseKey: string | null
  email: string | null
  activationId: string | null
  playerSlots: number | null
  slotsUsed: number | null
  slotsTotal: number | null
  expiresAt: string | null
  lastOnlineCheck: string | null
  graceOfflineDays: number
  message: string | null
}

export interface ActivateRequest {
  licenseKey: string
  email: string
  machineId: string
  product: LicenseProduct
  hostname: string
}

export interface ActivateResponse {
  license: StoredLicense
  slotsUsed?: number
  slotsTotal?: number
}

export interface HeartbeatRequest {
  licenseKey: string
  activationId: string
  machineId: string
  product: LicenseProduct
}

export interface HeartbeatResponse {
  valid: boolean
  reason?: string
  expiresAt?: string
  slotsUsed?: number
  slotsTotal?: number
}

export interface DeactivateRequest {
  licenseKey: string
  activationId: string
  machineId: string
  product: LicenseProduct
}

export const DEFAULT_GRACE_OFFLINE_DAYS = 14
export const HEARTBEAT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Public half of the throwaway DEV keypair used by the local licensing server.
 * This is published in the open source repo on purpose so local development
 * works out of the box. Production builds MUST ship a rotated public key that
 * matches the private key held in your secret manager (see services/licensing).
 */
export const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAbsGUkED8mRg41tqedbUatmz1DlRPpRDZGlfTXzP1KOE=
-----END PUBLIC KEY-----`

export function emptyLicenseStatus(product: LicenseProduct): LicenseStatus {
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
