/** Internal evaluator handle: a TOP output that still lives on the GPU. */

const GPU_PIXEL_REF = Symbol.for('pixelforge.gpuPixelRef')

export interface GpuPixelRef {
  readonly [GPU_PIXEL_REF]: true
  nodeId: string
}

export function gpuPixelRef(nodeId: string): GpuPixelRef {
  return { [GPU_PIXEL_REF]: true, nodeId }
}

export function isGpuPixelRef(value: unknown): value is GpuPixelRef {
  return typeof value === 'object' && value !== null && GPU_PIXEL_REF in value
}
