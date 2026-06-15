import { app } from 'electron'
import type { LicenseProduct } from '@shared/licensing/types'

export function initCrashReporting(product: LicenseProduct): void {
  if (process.env['PIXELFORGE_SENTRY_DSN'] === undefined) return

  void import('@sentry/electron/main')
    .then((Sentry) => {
      Sentry.init({
        dsn: process.env['PIXELFORGE_SENTRY_DSN'],
        environment: app.isPackaged ? 'production' : 'development',
        release: `${product}@${app.getVersion()}`,
        beforeSend(event) {
          if (event.request?.headers !== undefined) {
            delete event.request.headers['Authorization']
          }
          return event
        }
      })
    })
    .catch(() => {
      console.warn('[crash] Sentry not configured')
    })
}

export function initRendererCrashReporting(): void {
  if (process.env['PIXELFORGE_SENTRY_DSN'] === undefined) return
  void import('@sentry/electron/renderer').then((Sentry) => {
    Sentry.init({ dsn: process.env['PIXELFORGE_SENTRY_DSN'] })
  })
}
