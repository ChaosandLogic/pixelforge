import { app } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { hostname } from 'node:os'
import { evaluateLicense, isLicenseUsable } from '@shared/licensing/verify'
import { verifyLicenseSignature } from './signature'
import {
  DEFAULT_GRACE_OFFLINE_DAYS,
  emptyLicenseStatus,
  HEARTBEAT_INTERVAL_MS,
  type LicenseProduct,
  type LicenseStatus,
  type StoredLicense
} from '@shared/licensing/types'
import { activateRemote, deactivateRemote, heartbeatRemote } from './activationApi'
import { getMachineId } from './machineId'

export class LicenseManager {
  private readonly product: LicenseProduct
  private licensePath = ''
  private cached: StoredLicense | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  constructor(product: LicenseProduct) {
    this.product = product
  }

  private path(): string {
    if (this.licensePath === '') {
      this.licensePath = join(app.getPath('userData'), 'license.pflic')
    }
    return this.licensePath
  }

  async init(): Promise<void> {
    await mkdir(app.getPath('userData'), { recursive: true })
    this.cached = await this.readStored()
    this.startHeartbeat()
  }

  async getStatus(): Promise<LicenseStatus> {
    const machineId = await getMachineId()
    const signatureValid = this.cached !== null ? verifyLicenseSignature(this.cached) : false
    const status = evaluateLicense(this.cached, machineId, this.product, { signatureValid })
    if (this.cached !== null && status.state === 'valid') {
      try {
        const hb = await heartbeatRemote({
          licenseKey: this.cached.payload.licenseKey,
          activationId: this.cached.payload.activationId,
          machineId,
          product: this.product
        })
        if (hb.valid) {
          await this.touchOnlineCheck()
          return {
            ...status,
            slotsUsed: hb.slotsUsed ?? null,
            slotsTotal: hb.slotsTotal ?? status.playerSlots
          }
        }
        return evaluateLicense(this.cached, machineId, this.product, {
          signatureValid: verifyLicenseSignature(this.cached)
        })
      } catch {
        return evaluateLicense(this.cached, machineId, this.product, {
          signatureValid: verifyLicenseSignature(this.cached)
        })
      }
    }
    return status
  }

  async isUsable(): Promise<boolean> {
    const status = await this.getStatus()
    return isLicenseUsable(status.state)
  }

  /**
   * Local-only usability check (no network heartbeat). Used to gate the engine
   * port and DMX output without blocking on a slow/absent activation server.
   */
  async isUsableOffline(): Promise<boolean> {
    const machineId = await getMachineId()
    const signatureValid = this.cached !== null ? verifyLicenseSignature(this.cached) : false
    const status = evaluateLicense(this.cached, machineId, this.product, { signatureValid })
    return isLicenseUsable(status.state)
  }

  async activate(licenseKey: string, email: string): Promise<LicenseStatus> {
    const machineId = await getMachineId()
    const { license, slotsUsed, slotsTotal } = await activateRemote({
      licenseKey: licenseKey.trim(),
      email: email.trim(),
      machineId,
      product: this.product,
      hostname: hostname()
    })
    await this.writeStored(license)
    this.cached = license
    const status = evaluateLicense(license, machineId, this.product, {
      signatureValid: verifyLicenseSignature(license)
    })
    return {
      ...status,
      slotsUsed: slotsUsed ?? null,
      slotsTotal: slotsTotal ?? status.playerSlots
    }
  }

  async deactivate(): Promise<void> {
    if (this.cached === null) return
    const machineId = await getMachineId()
    await deactivateRemote({
      licenseKey: this.cached.payload.licenseKey,
      activationId: this.cached.payload.activationId,
      machineId,
      product: this.product
    })
    await this.removeStored()
    this.cached = null
  }

  private async readStored(): Promise<StoredLicense | null> {
    const licensePath = this.path()
    if (!existsSync(licensePath)) return null
    try {
      const raw: unknown = JSON.parse(await readFile(licensePath, 'utf-8'))
      if (typeof raw !== 'object' || raw === null) return null
      const obj = raw as StoredLicense
      if (obj.payload === undefined || obj.signature === undefined) return null
      return obj
    } catch {
      return null
    }
  }

  private async writeStored(license: StoredLicense): Promise<void> {
    await writeFile(this.path(), JSON.stringify(license, null, 2), 'utf-8')
    this.cached = license
  }

  private async touchOnlineCheck(): Promise<void> {
    if (this.cached === null) return
    this.cached = { ...this.cached, lastOnlineCheck: new Date().toISOString() }
    await writeFile(this.path(), JSON.stringify(this.cached, null, 2), 'utf-8')
  }

  private async removeStored(): Promise<void> {
    const licensePath = this.path()
    if (existsSync(licensePath)) await unlink(licensePath)
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer !== null) return
    this.heartbeatTimer = setInterval(() => {
      void this.getStatus()
    }, HEARTBEAT_INTERVAL_MS)
  }

  dispose(): void {
    if (this.heartbeatTimer !== null) clearInterval(this.heartbeatTimer)
  }
}

export function devBypassEnabled(): boolean {
  // Only honour the dev bypass in unpackaged (development) builds. Setting the
  // env var in a shipped .app/.exe must never skip license enforcement.
  if (app.isPackaged) return false
  return process.env['PIXELFORGE_DEV_LICENSE'] === '1'
}

export async function getDevLicenseStatus(product: LicenseProduct): Promise<LicenseStatus> {
  return {
    state: 'valid',
    product,
    licenseKey: 'DEV-BYPASS',
    email: 'dev@local',
    activationId: 'dev',
    playerSlots: 99,
    slotsUsed: 0,
    slotsTotal: 99,
    expiresAt: null,
    lastOnlineCheck: new Date().toISOString(),
    graceOfflineDays: DEFAULT_GRACE_OFFLINE_DAYS,
    message: null
  }
}

export { emptyLicenseStatus, isLicenseUsable }
