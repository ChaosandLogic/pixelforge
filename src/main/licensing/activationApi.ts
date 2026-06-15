import type { LicenseProduct, StoredLicense } from '@shared/licensing/types'

const DEFAULT_BASE_URL = process.env['PIXELFORGE_LICENSE_API'] ?? 'http://127.0.0.1:8787'

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${DEFAULT_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data: unknown = await res.json()
  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`
    throw new Error(message)
  }
  return data as T
}

export async function activateRemote(
  request: import('@shared/licensing/types').ActivateRequest
): Promise<import('@shared/licensing/types').ActivateResponse> {
  return postJson('/v1/activate', request)
}

export async function deactivateRemote(
  request: import('@shared/licensing/types').DeactivateRequest
): Promise<void> {
  await postJson('/v1/deactivate', request)
}

export async function heartbeatRemote(
  request: import('@shared/licensing/types').HeartbeatRequest
): Promise<import('@shared/licensing/types').HeartbeatResponse> {
  return postJson('/v1/heartbeat', request)
}

export async function getLicenseStatusRemote(licenseKey: string): Promise<{
  slotsUsed: number
  slotsTotal: number
  editorSeats: number
}> {
  const res = await fetch(`${DEFAULT_BASE_URL}/v1/license/${encodeURIComponent(licenseKey)}/status`)
  if (!res.ok) throw new Error(`Status request failed (${res.status})`)
  return res.json() as Promise<{ slotsUsed: number; slotsTotal: number; editorSeats: number }>
}

export function signLicenseLocally(license: StoredLicense): StoredLicense {
  return license
}

export type { LicenseProduct }
