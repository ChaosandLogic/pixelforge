import { GPU_PREVIEW_SIZE, GPU_WORKING_RES_MAX } from './topNodes'

export { GPU_PREVIEW_SIZE, GPU_WORKING_RES_MAX }

/** Length-prefixed IPC magic: 'PFGP'. */
export const GPU_IPC_MAGIC = 0x50464750
export const GPU_PROTOCOL_VERSION = 1

export interface GpuHelloOk {
  kind: 'hello-ok'
  gpu: boolean
  share: 'syphon' | 'spout' | 'none'
  error: string | null
}

export interface GpuCompileNode {
  id: string
  type: string
  width: number
  height: number
  /** Pixel-port name → upstream node id. */
  inputs: Record<string, string>
}

export interface GpuCompileRequest {
  nodes: GpuCompileNode[]
  pixelCount: number
  resolutionWidth: number
  resolutionHeight: number
}

export interface GpuGradientStop {
  t: number
  r: number
  g: number
  b: number
}

export interface GpuNodeUniforms {
  floats: number[]
  colours: number[]
  ints: number[]
  strings: string[]
  stops?: GpuGradientStop[]
}

export interface GpuShareIn {
  nodeId: string
  sender: string
}

export interface GpuShareOut {
  nodeId: string
  name: string
  width: number
  height: number
  mapping: 'grid' | 'layout'
  sourceNodeId: string
  fromCpu: boolean
}

export interface GpuMediaRef {
  nodeId: string
  path: string
  kind: 'video' | 'image'
}

export interface GpuFrameRequest {
  timeMs: number
  deltaMs: number
  liveNodeIds: string[]
  uniforms: Record<string, GpuNodeUniforms>
  cpuUploadIds: string[]
  sampleNodeIds: string[]
  previewNodeIds: string[]
  feedbackResets: string[]
  media: GpuMediaRef[]
  shareIn: GpuShareIn[]
  shareOut: GpuShareOut[]
}

export interface GpuBakeRequest {
  durationMs: number
  fps: number
  sampleNodeId: string
}

export type GpuRequest =
  | { id: number; kind: 'hello' }
  | { id: number; kind: 'compile'; body: GpuCompileRequest }
  | { id: number; kind: 'frame'; body: GpuFrameRequest }
  | { id: number; kind: 'bake'; body: GpuBakeRequest }
  | { id: number; kind: 'shutdown' }

export interface GpuPreviewBlob {
  nodeId: string
  width: number
  height: number
}

export interface GpuFrameResultBody {
  error: string | null
  shareSenders: string[]
  shareError: string | null
  sampleIds: string[]
  previews: GpuPreviewBlob[]
}

export interface GpuBakeResultBody {
  error: string | null
  frameCount: number
  pixelCount: number
  fps: number
}

export type GpuResponse =
  | { id: number; kind: 'hello-ok'; body: GpuHelloOk }
  | { id: number; kind: 'compile-ok' }
  | { id: number; kind: 'compile-error'; error: string }
  | { id: number; kind: 'frame-ok'; body: GpuFrameResultBody }
  | { id: number; kind: 'bake-ok'; body: GpuBakeResultBody }
  | { id: number; kind: 'error'; error: string }
