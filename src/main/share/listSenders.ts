import { createRequire } from 'node:module'
import { mergeShareSenders, shareSenderLabel, type ShareSenderInfo } from '@shared/share/senders'

interface NativeShare {
  listSenders: () => ShareSenderInfo[]
  getPlatform?: () => string
}

let native: NativeShare | null | undefined

function loadNative(): NativeShare | null {
  if (native !== undefined) return native
  if (process.platform !== 'darwin' && process.platform !== 'win32') {
    native = null
    return null
  }
  try {
    const require = createRequire(import.meta.url)
    native = require('@napolab/texture-bridge') as NativeShare
  } catch (err) {
    console.warn('[share] listSenders native module unavailable:', err instanceof Error ? err.message : err)
    native = null
  }
  return native
}

/** Discover Syphon/Spout senders from Electron main, which has a Cocoa run loop. */
export function listShareSenders(): string[] {
  const mod = loadNative()
  if (mod === null) return []
  try {
    return mergeShareSenders(mod.listSenders().map(shareSenderLabel))
  } catch (err) {
    console.warn('[share] listSenders failed:', err instanceof Error ? err.message : err)
    return []
  }
}
