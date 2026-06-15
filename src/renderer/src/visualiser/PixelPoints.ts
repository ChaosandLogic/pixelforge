import {
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3
} from 'three'
import type { PatchPoint } from '@shared/patch/types'
import { patchPointToThree } from './layoutCoords'

const FALLBACK = new Color(0.55, 0.62, 0.72)
const _matrix = new Matrix4()
const _pos = new Vector3()
const _color = new Color()

/**
 * InstancedMesh of small spheres — one instance per patch point. Colours
 * update each frame from the engine's RGB byte buffer.
 */
export class PixelPoints {
  readonly mesh: InstancedMesh
  private count = 0
  private pixelSize = 0.025

  constructor(maxCount: number) {
    const geometry = new SphereGeometry(1, 10, 8)
    const material = new MeshBasicMaterial()
    this.mesh = new InstancedMesh(geometry, material, Math.max(1, maxCount))
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.count = 0
  }

  setPixelSize(size: number): void {
    this.pixelSize = Math.max(0.001, size)
    this.updateTransforms(this.lastPoints)
  }

  private lastPoints: PatchPoint[] = []

  setPositions(points: PatchPoint[]): void {
    this.lastPoints = points
    this.count = points.length
    this.mesh.count = this.count
    this.updateTransforms(points)
  }

  private updateTransforms(points: PatchPoint[]): void {
    const scale = this.pixelSize
    for (let i = 0; i < points.length; i++) {
      const p = points[i] as PatchPoint
      patchPointToThree(p, _pos)
      _matrix.makeScale(scale, scale, scale)
      _matrix.setPosition(_pos)
      this.mesh.setMatrixAt(i, _matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  updateColors(frame: Uint8Array | null, pixelCount: number): void {
    for (let i = 0; i < this.count; i++) {
      if (frame !== null && i < pixelCount) {
        const r = (frame[i * 3] ?? 0) / 255
        const g = (frame[i * 3 + 1] ?? 0) / 255
        const b = (frame[i * 3 + 2] ?? 0) / 255
        _color.setRGB(r, g, b)
      } else {
        _color.copy(FALLBACK)
      }
      this.mesh.setColorAt(i, _color)
    }
    if (this.mesh.instanceColor !== null) {
      this.mesh.instanceColor.needsUpdate = true
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as MeshBasicMaterial).dispose()
    this.mesh.dispose()
  }
}
