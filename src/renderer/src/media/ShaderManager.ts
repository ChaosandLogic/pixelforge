import { SHADER_NODE_TYPE } from '@shared/graph/nodes/generators/Shader'
import {
  DEFAULT_SHADER_PRESET_ID,
  getShaderPreset,
  type ShaderPreset
} from '@shared/graph/shaders/presets'
import type { ColourValue, ParamValue } from '@shared/graph/types'
import { engineBridge } from '@/engine/bridge'
import { usePatchStore } from '@/store/patchStore'
import { useGraphStore, type PfNode } from '@/store/graphStore'

/**
 * Renders curated generator/shader presets via WebGL2 and pushes RGB frames
 * to the engine (same media-frame path as Image/Video).
 */

const MAX_SAMPLE = 128
const SAMPLE_FPS = 30

const VERT_SRC = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
out vec2 v_uv;
void main() {
  vec2 p = POS[gl_VertexID];
  v_uv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`

function fragmentSource(body: string): string {
  return `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_scale;
uniform vec3 u_colourA;
uniform vec3 u_colourB;
uniform float u_intensity;
out vec4 fragColor;
${body}
`
}

interface ShaderProgram {
  program: WebGLProgram
  presetId: string
  uResolution: WebGLUniformLocation | null
  uTime: WebGLUniformLocation | null
  uScale: WebGLUniformLocation | null
  uColourA: WebGLUniformLocation | null
  uColourB: WebGLUniformLocation | null
  uIntensity: WebGLUniformLocation | null
}

interface ShaderEntry {
  presetId: string
  program: ShaderProgram | null
  compileError: string | null
  disposed: boolean
}

const entries = new Map<string, ShaderEntry>()

let gl: WebGL2RenderingContext | null = null
let canvas: OffscreenCanvas | HTMLCanvasElement | null = null
let vao: WebGLVertexArrayObject | null = null
let programCache = new Map<string, ShaderProgram>()
let startedAt = performance.now()
let initFailed = false

function sampleDimensions(): { width: number; height: number } {
  const { resolution } = usePatchStore.getState()
  return {
    width: Math.max(1, Math.min(MAX_SAMPLE, resolution.width)),
    height: Math.max(1, Math.min(MAX_SAMPLE, resolution.height))
  }
}

function ensureContext(): WebGL2RenderingContext | null {
  if (gl !== null) return gl
  if (initFailed) return null

  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(16, 16)
    } else {
      const el = document.createElement('canvas')
      el.width = 16
      el.height = 16
      canvas = el
    }
    gl = canvas.getContext('webgl2', {
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true
    }) as WebGL2RenderingContext | null
  } catch (err) {
    console.error('[shader] WebGL2 init failed', err)
    initFailed = true
    return null
  }

  if (gl === null) {
    console.error('[shader] WebGL2 unavailable')
    initFailed = true
    return null
  }

  vao = gl.createVertexArray()
  if (vao !== null) gl.bindVertexArray(vao)
  return gl
}

function compileShader(ctx: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = ctx.createShader(type)
  if (shader === null) return null
  ctx.shaderSource(shader, source)
  ctx.compileShader(shader)
  if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
    const info = ctx.getShaderInfoLog(shader) ?? 'compile failed'
    ctx.deleteShader(shader)
    throw new Error(info)
  }
  return shader
}

function buildProgram(ctx: WebGL2RenderingContext, preset: ShaderPreset): ShaderProgram {
  const cached = programCache.get(preset.id)
  if (cached !== undefined) return cached

  const vs = compileShader(ctx, ctx.VERTEX_SHADER, VERT_SRC)
  const fs = compileShader(ctx, ctx.FRAGMENT_SHADER, fragmentSource(preset.glsl))
  if (vs === null || fs === null) throw new Error('shader object creation failed')

  const program = ctx.createProgram()
  if (program === null) throw new Error('program creation failed')
  ctx.attachShader(program, vs)
  ctx.attachShader(program, fs)
  ctx.linkProgram(program)
  ctx.deleteShader(vs)
  ctx.deleteShader(fs)
  if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
    const info = ctx.getProgramInfoLog(program) ?? 'link failed'
    ctx.deleteProgram(program)
    throw new Error(info)
  }

  const built: ShaderProgram = {
    program,
    presetId: preset.id,
    uResolution: ctx.getUniformLocation(program, 'u_resolution'),
    uTime: ctx.getUniformLocation(program, 'u_time'),
    uScale: ctx.getUniformLocation(program, 'u_scale'),
    uColourA: ctx.getUniformLocation(program, 'u_colourA'),
    uColourB: ctx.getUniformLocation(program, 'u_colourB'),
    uIntensity: ctx.getUniformLocation(program, 'u_intensity')
  }
  programCache.set(preset.id, built)
  return built
}

function floatParam(params: Record<string, ParamValue>, name: string, fallback: number): number {
  const v = params[name]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function colourParam(params: Record<string, ParamValue>, name: string, fallback: ColourValue): ColourValue {
  const v = params[name]
  if (typeof v === 'object' && v !== null && 'r' in v) return v as ColourValue
  return fallback
}

function stringParam(params: Record<string, ParamValue>, name: string, fallback: string): string {
  const v = params[name]
  return typeof v === 'string' ? v : fallback
}

function syncEntries(nodes: PfNode[]): void {
  const wanted = new Set<string>()
  for (const n of nodes) {
    if (n.data.nodeType !== SHADER_NODE_TYPE) continue
    wanted.add(n.id)
    const presetId = stringParam(n.data.params, 'preset', DEFAULT_SHADER_PRESET_ID)
    let entry = entries.get(n.id)
    if (entry === undefined) {
      entry = { presetId, program: null, compileError: null, disposed: false }
      entries.set(n.id, entry)
    }
    if (entry.presetId !== presetId) {
      entry.presetId = presetId
      entry.program = null
      entry.compileError = null
    }
  }

  for (const [nodeId, entry] of entries) {
    if (!wanted.has(nodeId)) {
      entry.disposed = true
      entries.delete(nodeId)
    }
  }
}

function ensureProgram(entry: ShaderEntry): ShaderProgram | null {
  const ctx = ensureContext()
  if (ctx === null) return null
  if (entry.program !== null && entry.program.presetId === entry.presetId) return entry.program
  if (entry.compileError !== null) return null

  try {
    entry.program = buildProgram(ctx, getShaderPreset(entry.presetId))
    entry.compileError = null
    return entry.program
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    entry.compileError = message
    entry.program = null
    console.error(`[shader] compile failed for preset ${entry.presetId}:`, message)
    return null
  }
}

function readRgb(ctx: WebGL2RenderingContext, width: number, height: number): Uint8Array {
  const rgba = new Uint8Array(width * height * 4)
  ctx.readPixels(0, 0, width, height, ctx.RGBA, ctx.UNSIGNED_BYTE, rgba)
  const rgb = new Uint8Array(width * height * 3)
  // WebGL origin is bottom-left; flip Y to match Image/Video top-left UV.
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y
    for (let x = 0; x < width; x++) {
      const si = (srcY * width + x) * 4
      const di = (y * width + x) * 3
      rgb[di] = rgba[si] ?? 0
      rgb[di + 1] = rgba[si + 1] ?? 0
      rgb[di + 2] = rgba[si + 2] ?? 0
    }
  }
  return rgb
}

function blackFrame(width: number, height: number): Uint8Array {
  return new Uint8Array(width * height * 3)
}

function sampleAll(): void {
  const ctx = ensureContext()
  const { width, height } = sampleDimensions()
  const nodes = useGraphStore.getState().nodes
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  if (canvas !== null && (canvas.width !== width || canvas.height !== height)) {
    canvas.width = width
    canvas.height = height
  }

  const timeSec = (performance.now() - startedAt) / 1000

  for (const [nodeId, entry] of entries) {
    if (entry.disposed) continue
    const node = nodeById.get(nodeId)
    if (node === undefined) continue

    if (ctx === null || canvas === null) {
      engineBridge.send({
        type: 'media-frame',
        nodeId,
        width,
        height,
        data: blackFrame(width, height)
      })
      continue
    }

    const program = ensureProgram(entry)
    if (program === null) {
      engineBridge.send({
        type: 'media-frame',
        nodeId,
        width,
        height,
        data: blackFrame(width, height)
      })
      continue
    }

    const params = node.data.params
    const speed = floatParam(params, 'speed', 1)
    const scale = floatParam(params, 'scale', 1)
    const intensity = floatParam(params, 'intensity', 1)
    const colourA = colourParam(params, 'colourA', { r: 10, g: 20, b: 80 })
    const colourB = colourParam(params, 'colourB', { r: 0, g: 220, b: 180 })
    const phase = floatParam(params, 'phase', 0)
    const t = timeSec * speed + phase

    ctx.viewport(0, 0, width, height)
    ctx.useProgram(program.program)
    if (vao !== null) ctx.bindVertexArray(vao)
    ctx.uniform2f(program.uResolution, width, height)
    ctx.uniform1f(program.uTime, t)
    ctx.uniform1f(program.uScale, scale)
    ctx.uniform3f(program.uColourA, colourA.r / 255, colourA.g / 255, colourA.b / 255)
    ctx.uniform3f(program.uColourB, colourB.r / 255, colourB.g / 255, colourB.b / 255)
    ctx.uniform1f(program.uIntensity, intensity)
    ctx.drawArrays(ctx.TRIANGLES, 0, 3)

    const rgb = readRgb(ctx, width, height)
    engineBridge.send({ type: 'media-frame', nodeId, width, height, data: rgb })
  }
}

export function initShaderManager(): void {
  startedAt = performance.now()
  syncEntries(useGraphStore.getState().nodes)
  useGraphStore.subscribe((state) => syncEntries(state.nodes))
  setInterval(sampleAll, 1000 / SAMPLE_FPS)
}
