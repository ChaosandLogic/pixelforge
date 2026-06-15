import { createPrivateKey, createPublicKey, randomUUID, sign, verify as cryptoVerify } from 'node:crypto'
import type { LicensePayload, StoredLicense } from '@shared/licensing/types'
import { LICENSE_PUBLIC_KEY_PEM } from '@shared/licensing/types'

function canonicalPayload(payload: LicensePayload): string {
  return JSON.stringify({
    product: payload.product,
    licenseKey: payload.licenseKey,
    email: payload.email,
    machineId: payload.machineId,
    activationId: payload.activationId,
    playerSlots: payload.playerSlots ?? null,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt ?? null,
    graceOfflineDays: payload.graceOfflineDays
  })
}

export function verifyLicenseSignature(
  license: StoredLicense,
  publicKeyPem = LICENSE_PUBLIC_KEY_PEM
): boolean {
  try {
    const key = createPublicKey(publicKeyPem)
    const data = Buffer.from(canonicalPayload(license.payload), 'utf8')
    const signature = Buffer.from(license.signature, 'base64')
    return cryptoVerify(null, data, key, signature)
  } catch {
    return false
  }
}

export function signLicensePayload(payload: LicensePayload, privateKeyPem: string): StoredLicense {
  const privateKey = createPrivateKey(privateKeyPem)
  const data = Buffer.from(canonicalPayload(payload), 'utf8')
  const signature = sign(null, data, privateKey).toString('base64')
  return { payload, signature, lastOnlineCheck: new Date().toISOString() }
}

export function newActivationId(): string {
  return randomUUID()
}
