/**
 * Pool of pixel buffers (Float32Array, rgb triplets). Nodes acquire buffers
 * per frame; the pool is reset (not freed) at the start of each frame, so
 * steady-state evaluation allocates nothing.
 */
export class BufferPool {
  private buffers: Float32Array[] = []
  private used = 0
  private floatsPerBuffer: number

  constructor(pixelCount: number) {
    this.floatsPerBuffer = pixelCount * 3
  }

  setPixelCount(pixelCount: number): void {
    const floats = pixelCount * 3
    if (floats !== this.floatsPerBuffer) {
      this.floatsPerBuffer = floats
      this.buffers = []
      this.used = 0
    }
  }

  acquire(): Float32Array {
    if (this.used < this.buffers.length) {
      const buf = this.buffers[this.used] as Float32Array
      this.used++
      return buf
    }
    const buf = new Float32Array(this.floatsPerBuffer)
    this.buffers.push(buf)
    this.used++
    return buf
  }

  /** Call at the start of every frame. Buffers handed out become reusable. */
  releaseAll(): void {
    this.used = 0
  }
}
