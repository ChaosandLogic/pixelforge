import { readSync } from 'node:fs'
import { GPU_IPC_MAGIC, GPU_PROTOCOL_VERSION } from '@shared/gpu/protocol'

export interface GpuIpcMessage {
  header: unknown
  blobs: Map<string, Buffer>
}

export function encodeGpuMessage(header: unknown, blobs: Map<string, Buffer> = new Map()): Buffer {
  const json = Buffer.from(JSON.stringify(header), 'utf8')
  const parts: Buffer[] = [
    u32(GPU_IPC_MAGIC),
    u32(GPU_PROTOCOL_VERSION),
    u32(json.length),
    json,
    u32(blobs.size)
  ]
  for (const [name, data] of blobs) {
    const nameBuf = Buffer.from(name, 'utf8')
    parts.push(u32(nameBuf.length), nameBuf, u32(data.length), data)
  }
  return Buffer.concat(parts)
}

export function decodeGpuMessage(buf: Buffer): GpuIpcMessage {
  let off = 0
  const magic = buf.readUInt32LE(off)
  off += 4
  if (magic !== GPU_IPC_MAGIC) throw new Error('bad gpu ipc magic')
  const version = buf.readUInt32LE(off)
  off += 4
  if (version !== GPU_PROTOCOL_VERSION) throw new Error(`unsupported gpu ipc version ${version}`)
  const headerLen = buf.readUInt32LE(off)
  off += 4
  const header = JSON.parse(buf.subarray(off, off + headerLen).toString('utf8')) as unknown
  off += headerLen
  const nBlobs = buf.readUInt32LE(off)
  off += 4
  const blobs = new Map<string, Buffer>()
  for (let i = 0; i < nBlobs; i++) {
    const nameLen = buf.readUInt32LE(off)
    off += 4
    const name = buf.subarray(off, off + nameLen).toString('utf8')
    off += nameLen
    const dataLen = buf.readUInt32LE(off)
    off += 4
    blobs.set(name, Buffer.from(buf.subarray(off, off + dataLen)))
    off += dataLen
  }
  return { header, blobs }
}

export function readExact(fd: number, nbytes: number): Buffer {
  const buf = Buffer.alloc(nbytes)
  let off = 0
  while (off < nbytes) {
    const n = readSync(fd, buf, off, nbytes - off, null)
    if (n <= 0) throw new Error('gpu-engine closed the pipe')
    off += n
  }
  return buf
}

export function readGpuMessage(fd: number): GpuIpcMessage {
  const prefix = readExact(fd, 12)
  const magic = prefix.readUInt32LE(0)
  if (magic !== GPU_IPC_MAGIC) throw new Error('bad gpu ipc magic')
  const version = prefix.readUInt32LE(4)
  if (version !== GPU_PROTOCOL_VERSION) throw new Error(`unsupported gpu ipc version ${version}`)
  const headerLen = prefix.readUInt32LE(8)
  const headerBuf = readExact(fd, headerLen)
  const nBlobBuf = readExact(fd, 4)
  const nBlobs = nBlobBuf.readUInt32LE(0)
  const rest: Buffer[] = [prefix, headerBuf, nBlobBuf]
  for (let i = 0; i < nBlobs; i++) {
    const nameLen = readExact(fd, 4)
    const name = readExact(fd, nameLen.readUInt32LE(0))
    const dataLen = readExact(fd, 4)
    const data = readExact(fd, dataLen.readUInt32LE(0))
    rest.push(nameLen, name, dataLen, data)
  }
  return decodeGpuMessage(Buffer.concat(rest))
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n >>> 0, 0)
  return b
}
