import { AUDIO_IN_NODE_TYPE, audioSourceMode } from '@shared/graph/nodes/audio/AudioIn'
import { BEAT_NODE_TYPE } from '@shared/graph/nodes/audio/Beat'
import { floatParam } from '@shared/graph/types'
import { engineBridge } from '@/engine/bridge'
import { useGraphStore, type PfNode } from '@/store/graphStore'

/**
 * Owns Web Audio analysis for every Audio In node. FFT + band split +
 * attack/release smoothing run in the renderer; band levels are pushed to
 * the engine as float outputs.
 */

const FFT_SIZE = 2048
const MIN_HZ = 20
const ANALYSIS_FPS = 60

interface AudioEntry {
  nodeId: string
  source: 'device' | 'file'
  deviceId: string
  filePath: string
  monitor: boolean
  analyser: AnalyserNode
  sourceNode: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null
  audioElement: HTMLAudioElement | null
  fftData: Float32Array
  spectrum: Float32Array
  smoothed: { low: number; mid: number; high: number }
  beatPulse: number
  prevLow: number
  fluxAvg: number
  error: string | null
  disposed: boolean
}

interface LocalAudioState {
  levels: { low: number; mid: number; high: number; beat: number }
  spectrum: Float32Array
  lowMax: number
  midMax: number
  sampleRate: number
  binHz: number
  error: string | null
}

let audioCtx: AudioContext | null = null
const deviceStreams = new Map<string, MediaStream>()
const entries = new Map<string, AudioEntry>()
const urlCache = new Map<string, Promise<string>>()
const pathRefs = new Map<string, number>()
let devicesCache: MediaDeviceInfo[] = []

function getAudioContext(): AudioContext {
  if (audioCtx === null || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

function entryKey(node: PfNode): string {
  const params = node.data.params
  const source = audioSourceMode(params)
  const device = typeof params['device'] === 'string' ? params['device'] : ''
  const file = typeof params['file'] === 'string' ? params['file'] : ''
  return `${source}:${device}:${file}`
}

function mimeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg'
    case 'wav':
      return 'audio/wav'
    case 'ogg':
      return 'audio/ogg'
    case 'flac':
      return 'audio/flac'
    case 'aac':
    case 'm4a':
      return 'audio/mp4'
    default:
      return 'audio/mpeg'
  }
}

function retainPath(path: string): void {
  pathRefs.set(path, (pathRefs.get(path) ?? 0) + 1)
}

function releasePath(path: string): void {
  const next = (pathRefs.get(path) ?? 1) - 1
  if (next > 0) {
    pathRefs.set(path, next)
    return
  }
  pathRefs.delete(path)
  const cached = urlCache.get(path)
  urlCache.delete(path)
  if (cached !== undefined) {
    void cached.then((url) => URL.revokeObjectURL(url)).catch(() => {})
  }
}

async function loadObjectUrl(path: string): Promise<string> {
  retainPath(path)
  let cached = urlCache.get(path)
  if (cached === undefined) {
    cached = window.pixelforge.readMediaFile(path).then((bytes) => {
      return URL.createObjectURL(new Blob([bytes], { type: mimeFor(path) }))
    })
    urlCache.set(path, cached)
  }
  return cached
}

async function ensureMicAccess(): Promise<void> {
  await window.pixelforge.requestMicAccess()
}

async function getDeviceStream(deviceId: string): Promise<MediaStream> {
  await ensureMicAccess()
  const existing = deviceStreams.get(deviceId)
  if (existing !== undefined) return existing

  const constraints: MediaStreamConstraints =
    deviceId === ''
      ? { audio: true }
      : { audio: { deviceId: { exact: deviceId } } }

  const stream = await navigator.mediaDevices.getUserMedia(constraints)
  deviceStreams.set(deviceId, stream)
  return stream
}

function disconnectEntry(entry: AudioEntry): void {
  entry.sourceNode?.disconnect()
  entry.analyser.disconnect()
  if (entry.audioElement !== null) {
    entry.audioElement.pause()
    entry.audioElement.removeAttribute('src')
    entry.audioElement.load()
  }
  entry.sourceNode = null
  entry.audioElement = null
}

function disposeEntry(entry: AudioEntry): void {
  entry.disposed = true
  disconnectEntry(entry)
  if (entry.filePath !== '') releasePath(entry.filePath)
}

async function buildEntry(node: PfNode): Promise<AudioEntry> {
  const params = node.data.params
  const source = audioSourceMode(params)
  const deviceId = typeof params['device'] === 'string' ? params['device'] : ''
  const filePath = typeof params['file'] === 'string' ? params['file'] : ''
  const monitor = params['monitor'] !== false

  const ctx = getAudioContext()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = FFT_SIZE
  analyser.smoothingTimeConstant = 0.4

  const entry: AudioEntry = {
    nodeId: node.id,
    source,
    deviceId,
    filePath,
    monitor,
    analyser,
    sourceNode: null,
    audioElement: null,
    fftData: new Float32Array(analyser.frequencyBinCount),
    spectrum: new Float32Array(analyser.frequencyBinCount),
    smoothed: { low: 0, mid: 0, high: 0 },
    beatPulse: 0,
    prevLow: 0,
    fluxAvg: 0.01,
    error: null,
    disposed: false
  }

  try {
    if (source === 'device') {
      const stream = await getDeviceStream(deviceId)
      if (entry.disposed) return entry
      const sourceNode = ctx.createMediaStreamSource(stream)
      sourceNode.connect(analyser)
      entry.sourceNode = sourceNode
    } else if (filePath !== '') {
      const audio = document.createElement('audio')
      audio.loop = true
      audio.crossOrigin = 'anonymous'
      entry.audioElement = audio

      const url = await loadObjectUrl(filePath)
      if (entry.disposed) return entry
      audio.src = url
      await audio.play().catch(() => {
        // Autoplay may require user gesture; analysis still works once playing.
      })

      const sourceNode = ctx.createMediaElementSource(audio)
      sourceNode.connect(analyser)
      if (monitor) sourceNode.connect(ctx.destination)
      entry.sourceNode = sourceNode
    }
  } catch (err: unknown) {
    entry.error = err instanceof Error ? err.message : String(err)
  }

  return entry
}

function updateMonitor(entry: AudioEntry): void {
  if (entry.source !== 'file' || entry.sourceNode === null || audioCtx === null) return
  try {
    entry.sourceNode.disconnect(audioCtx.destination)
  } catch {
    // Not connected.
  }
  if (entry.monitor) {
    entry.sourceNode.connect(audioCtx.destination)
  }
}

function dbToLinear(db: number): number {
  if (db <= -100) return 0
  const amp = Math.pow(10, db / 20)
  return amp > 1 ? 1 : amp
}

function bandAverage(data: Float32Array, minHz: number, maxHz: number, binHz: number): number {
  const startBin = Math.max(0, Math.floor(minHz / binHz))
  const endBin = Math.min(data.length - 1, Math.ceil(maxHz / binHz))
  if (startBin > endBin) return 0

  let sum = 0
  let count = 0
  for (let i = startBin; i <= endBin; i++) {
    sum += dbToLinear(data[i] ?? -100)
    count++
  }
  return count > 0 ? sum / count : 0
}

function smooth(current: number, target: number, attack: number, release: number, dt: number): number {
  const tau = target > current ? Math.max(0.001, attack) : Math.max(0.001, release)
  const alpha = 1 - Math.exp(-dt / tau)
  return current + (target - current) * alpha
}

function analyzeEntry(entry: AudioEntry, node: PfNode): void {
  if (entry.error !== null || entry.sourceNode === null) return

  const params = node.data.params
  const lowMax = floatParam(params, 'lowMax', 250)
  const midMax = Math.max(lowMax + 50, floatParam(params, 'midMax', 4000))
  const attack = floatParam(params, 'attack', 0.01)
  const release = floatParam(params, 'release', 0.25)

  entry.analyser.getFloatFrequencyData(entry.fftData as Float32Array<ArrayBuffer>)
  for (let i = 0; i < entry.fftData.length; i++) {
    entry.spectrum[i] = entry.fftData[i] ?? -100
  }

  const ctx = getAudioContext()
  const binHz = ctx.sampleRate / FFT_SIZE
  const nyquist = ctx.sampleRate / 2

  const rawLow = bandAverage(entry.fftData, MIN_HZ, lowMax, binHz)
  const rawMid = bandAverage(entry.fftData, lowMax, midMax, binHz)
  const rawHigh = bandAverage(entry.fftData, midMax, nyquist, binHz)

  const dt = 1 / ANALYSIS_FPS
  entry.smoothed.low = smooth(entry.smoothed.low, rawLow, attack, release, dt)
  entry.smoothed.mid = smooth(entry.smoothed.mid, rawMid, attack, release, dt)
  entry.smoothed.high = smooth(entry.smoothed.high, rawHigh, attack, release, dt)

  const flux = Math.max(0, entry.smoothed.low - entry.prevLow)
  entry.prevLow = entry.smoothed.low
  entry.fluxAvg = entry.fluxAvg * 0.92 + flux * 0.08
  const sensitivity =
    node.data.nodeType === BEAT_NODE_TYPE
      ? floatParam(params, 'sensitivity', 1.5)
      : 1.5
  if (flux > entry.fluxAvg * sensitivity) entry.beatPulse = 1
  else entry.beatPulse *= 0.88

  engineBridge.send({
    type: 'audio-levels',
    nodeId: entry.nodeId,
    low: entry.smoothed.low,
    mid: entry.smoothed.mid,
    high: entry.smoothed.high,
    beat: entry.beatPulse
  })
}

function entryKeyFromEntry(entry: AudioEntry): string {
  return `${entry.source}:${entry.deviceId}:${entry.filePath}`
}

function syncEntries(nodes: PfNode[]): void {
  const wanted = new Map<string, PfNode>()
  for (const n of nodes) {
    if (n.data.nodeType !== AUDIO_IN_NODE_TYPE && n.data.nodeType !== BEAT_NODE_TYPE) continue
    wanted.set(n.id, n)
  }

  for (const [nodeId, entry] of entries) {
    const node = wanted.get(nodeId)
    if (node === undefined || entryKey(node) !== entryKeyFromEntry(entry)) {
      disposeEntry(entry)
      entries.delete(nodeId)
    }
  }

  for (const [nodeId, node] of wanted) {
    const existing = entries.get(nodeId)
    const monitor = node.data.params['monitor'] !== false
    if (existing !== undefined) {
      if (existing.monitor !== monitor && existing.source === 'file') {
        existing.monitor = monitor
        updateMonitor(existing)
      }
      continue
    }

    void buildEntry(node).then((entry) => {
      if (entry.disposed) return
      entries.set(nodeId, entry)
    })
  }

  pruneDeviceStreams()
}

function pruneDeviceStreams(): void {
  const usedDevices = new Set<string>()
  for (const entry of entries.values()) {
    if (entry.source === 'device') usedDevices.add(entry.deviceId)
  }
  for (const [deviceId, stream] of deviceStreams) {
    if (!usedDevices.has(deviceId)) {
      for (const track of stream.getTracks()) track.stop()
      deviceStreams.delete(deviceId)
    }
  }
}

function analyzeAll(): void {
  const nodes = useGraphStore.getState().nodes
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const entry of entries.values()) {
    const node = byId.get(entry.nodeId)
    if (node !== undefined) analyzeEntry(entry, node)
  }
}

export async function refreshAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  try {
    await ensureMicAccess()
    const all = await navigator.mediaDevices.enumerateDevices()
    devicesCache = all.filter((d) => d.kind === 'audioinput')
  } catch {
    devicesCache = []
  }
  return devicesCache
}

export function getAudioInputDevices(): MediaDeviceInfo[] {
  return devicesCache
}

export function getLocalAudioState(nodeId: string): LocalAudioState | null {
  const entry = entries.get(nodeId)
  const node = useGraphStore.getState().nodes.find((n) => n.id === nodeId)
  if (entry === undefined || node === undefined) return null

  const ctx = getAudioContext()
  const params = node.data.params
  return {
    levels: { ...entry.smoothed, beat: entry.beatPulse },
    spectrum: entry.spectrum,
    lowMax: floatParam(params, 'lowMax', 250),
    midMax: floatParam(params, 'midMax', 4000),
    sampleRate: ctx.sampleRate,
    binHz: ctx.sampleRate / FFT_SIZE,
    error: entry.error
  }
}

export function initAudioManager(): void {
  syncEntries(useGraphStore.getState().nodes)
  useGraphStore.subscribe((state) => syncEntries(state.nodes))
  void refreshAudioInputDevices()
  setInterval(analyzeAll, 1000 / ANALYSIS_FPS)
}
