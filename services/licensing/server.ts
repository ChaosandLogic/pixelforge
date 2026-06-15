import { createPrivateKey, randomUUID, sign } from 'node:crypto'
import { createServer } from 'node:http'
import type {
  ActivateRequest,
  ActivateResponse,
  DeactivateRequest,
  HeartbeatRequest,
  HeartbeatResponse,
  LicensePayload,
  StoredLicense
} from '../../src/shared/licensing/types'

const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEICCQY5+EvbL1UUf82ebc06PE3y9mk0Ez0yp+cdUGKLF3
-----END PRIVATE KEY-----`

interface EditorLicense {
  licenseKey: string
  email: string
  playerSlots: number
  editorSeats: number
  expiresAt?: string
}

interface Activation {
  licenseKey: string
  machineId: string
  activationId: string
  hostname: string
  product: 'editor' | 'player'
  activatedAt: string
}

const licenses = new Map<string, EditorLicense>([
  [
    'PF-DEMO-EDITOR',
    { licenseKey: 'PF-DEMO-EDITOR', email: 'demo@pixelforge.app', playerSlots: 3, editorSeats: 1 }
  ]
])

const activations = new Map<string, Activation>()

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

function signPayload(payload: LicensePayload): StoredLicense {
  const privateKey = createPrivateKey(PRIVATE_KEY_PEM)
  const signature = sign(null, Buffer.from(canonicalPayload(payload), 'utf8'), privateKey).toString('base64')
  return { payload, signature, lastOnlineCheck: new Date().toISOString() }
}

function playerSlotsUsed(licenseKey: string): number {
  let count = 0
  for (const a of activations.values()) {
    if (a.licenseKey === licenseKey && a.product === 'player') count++
  }
  return count
}

function editorSeatsUsed(licenseKey: string): number {
  let count = 0
  for (const a of activations.values()) {
    if (a.licenseKey === licenseKey && a.product === 'editor') count++
  }
  return count
}

function findActivation(licenseKey: string, machineId: string, product: 'editor' | 'player'): Activation | undefined {
  for (const a of activations.values()) {
    if (a.licenseKey === licenseKey && a.machineId === machineId && a.product === product) return a
  }
  return undefined
}

function handleActivate(body: ActivateRequest): ActivateResponse {
  const license = licenses.get(body.licenseKey.trim())
  if (license === undefined) throw new Error('Unknown license key')
  if (license.email.toLowerCase() !== body.email.trim().toLowerCase()) {
    throw new Error('Email does not match license record')
  }

  const existing = findActivation(license.licenseKey, body.machineId, body.product)
  if (existing !== undefined) {
    const payload: LicensePayload = {
      product: body.product,
      licenseKey: license.licenseKey,
      email: license.email,
      machineId: body.machineId,
      activationId: existing.activationId,
      playerSlots: license.playerSlots,
      issuedAt: existing.activatedAt,
      expiresAt: license.expiresAt,
      graceOfflineDays: 14
    }
    return {
      license: signPayload(payload),
      slotsUsed: playerSlotsUsed(license.licenseKey),
      slotsTotal: license.playerSlots
    }
  }

  if (body.product === 'editor' && editorSeatsUsed(license.licenseKey) >= license.editorSeats) {
    throw new Error('All editor seats are in use. Deactivate another machine first.')
  }
  if (body.product === 'player' && playerSlotsUsed(license.licenseKey) >= license.playerSlots) {
    throw new Error('All player slots are in use. Deactivate another Player installation first.')
  }

  const activationId = randomUUID()
  const activatedAt = new Date().toISOString()
  activations.set(activationId, {
    licenseKey: license.licenseKey,
    machineId: body.machineId,
    activationId,
    hostname: body.hostname,
    product: body.product,
    activatedAt
  })

  const payload: LicensePayload = {
    product: body.product,
    licenseKey: license.licenseKey,
    email: license.email,
    machineId: body.machineId,
    activationId,
    playerSlots: license.playerSlots,
    issuedAt: activatedAt,
    expiresAt: license.expiresAt,
    graceOfflineDays: 14
  }

  return {
    license: signPayload(payload),
    slotsUsed: playerSlotsUsed(license.licenseKey),
    slotsTotal: license.playerSlots
  }
}

function handleDeactivate(body: DeactivateRequest): void {
  const activation = activations.get(body.activationId)
  if (activation === undefined) return
  if (activation.machineId !== body.machineId || activation.licenseKey !== body.licenseKey) {
    throw new Error('Activation mismatch')
  }
  activations.delete(body.activationId)
}

function handleHeartbeat(body: HeartbeatRequest): HeartbeatResponse {
  const license = licenses.get(body.licenseKey)
  if (license === undefined) return { valid: false, reason: 'Unknown license' }
  const activation = activations.get(body.activationId)
  if (activation === undefined) return { valid: false, reason: 'Activation not found' }
  if (activation.machineId !== body.machineId) return { valid: false, reason: 'Machine mismatch' }
  return {
    valid: true,
    expiresAt: license.expiresAt,
    slotsUsed: playerSlotsUsed(license.licenseKey),
    slotsTotal: license.playerSlots
  }
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  try {
    const url = req.url ?? '/'
    if (req.method === 'POST' && url === '/v1/activate') {
      const body = JSON.parse(await readBody(req)) as ActivateRequest
      const result = handleActivate(body)
      res.writeHead(200)
      res.end(JSON.stringify(result))
      return
    }
    if (req.method === 'POST' && url === '/v1/deactivate') {
      handleDeactivate(JSON.parse(await readBody(req)) as DeactivateRequest)
      res.writeHead(200)
      res.end(JSON.stringify({ ok: true }))
      return
    }
    if (req.method === 'POST' && url === '/v1/heartbeat') {
      const result = handleHeartbeat(JSON.parse(await readBody(req)) as HeartbeatRequest)
      res.writeHead(200)
      res.end(JSON.stringify(result))
      return
    }
    if (req.method === 'GET' && url.startsWith('/v1/license/') && url.endsWith('/status')) {
      const key = decodeURIComponent(url.slice('/v1/license/'.length, -'/status'.length))
      const license = licenses.get(key)
      if (license === undefined) {
        res.writeHead(404)
        res.end(JSON.stringify({ error: 'Unknown license' }))
        return
      }
      res.writeHead(200)
      res.end(
        JSON.stringify({
          slotsUsed: playerSlotsUsed(key),
          slotsTotal: license.playerSlots,
          editorSeats: license.editorSeats
        })
      )
      return
    }
    if (req.method === 'POST' && url === '/v1/webhook/purchase') {
      const body = JSON.parse(await readBody(req)) as {
        licenseKey: string
        email: string
        playerSlots?: number
        editorSeats?: number
      }
      licenses.set(body.licenseKey, {
        licenseKey: body.licenseKey,
        email: body.email,
        playerSlots: body.playerSlots ?? 2,
        editorSeats: body.editorSeats ?? 1
      })
      res.writeHead(200)
      res.end(JSON.stringify({ ok: true }))
      return
    }
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))
  } catch (err) {
    res.writeHead(400)
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Request failed' }))
  }
})

const port = Number(process.env['PORT'] ?? 8787)
server.listen(port, () => {
  console.log(`PixelForge licensing API listening on http://127.0.0.1:${port}`)
  console.log('Demo license: PF-DEMO-EDITOR / demo@pixelforge.app (3 player slots)')
})
