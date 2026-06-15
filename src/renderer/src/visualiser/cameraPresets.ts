import { Box3, PerspectiveCamera, Vector3 } from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { PatchPoint } from '@shared/patch/types'
import { patchPointToThree } from './layoutCoords'

const _box = new Box3()
const _center = new Vector3()
const _size = new Vector3()

export type CameraPreset = 'fit' | 'top' | 'front' | 'side'

/** Tight axis-aligned bounds of patch / fixture points. */
function tightPatchBox(points: PatchPoint[]): Box3 {
  if (points.length === 0) return new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5))

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const p of points) {
    patchPointToThree(p, _center)
    if (_center.x < minX) minX = _center.x
    if (_center.y < minY) minY = _center.y
    if (_center.z < minZ) minZ = _center.z
    if (_center.x > maxX) maxX = _center.x
    if (_center.y > maxY) maxY = _center.y
    if (_center.z > maxZ) maxZ = _center.z
  }
  return new Box3(new Vector3(minX, minY, minZ), new Vector3(maxX, maxY, maxZ))
}

/** Padded bounds so flat lines and thin fixtures frame well in 3D. */
function paddedPatchBox(points: PatchPoint[]): Box3 {
  const box = tightPatchBox(points)
  if (points.length === 0) return box

  box.getSize(_size)
  const padX = Math.max(0.1, _size.x * 0.12)
  const padY = Math.max(0.1, _size.y * 0.12, _size.x * 0.08)
  const padZ = Math.max(0.1, _size.z * 0.12, _size.x * 0.08)
  box.min.x -= padX
  box.min.y -= padY
  box.min.z -= padZ
  box.max.x += padX
  box.max.y += padY
  box.max.z += padZ
  return box
}

/** Orbit pivot — geometric centre of the fixture, not STL. */
export function patchCenter(points: PatchPoint[]): Vector3 {
  const box = tightPatchBox(points)
  box.getCenter(_center)
  return _center.clone()
}

export function combinedBounds(points: PatchPoint[], meshBox: Box3 | null): Box3 {
  const box = paddedPatchBox(points)
  if (meshBox !== null && !meshBox.isEmpty()) box.union(meshBox)
  if (box.isEmpty()) box.set(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5))
  return box
}

/** Suggest pixel sphere radius from scene extent. */
export function defaultPixelSize(box: Box3): number {
  box.getSize(_size)
  const extent = Math.max(_size.x, _size.y, _size.z, 0.001)
  return extent * 0.012
}

/** Framing margin for fit distance. */
const FIT_FRAMING = 1.35
/** Default view is 20% closer than a tight fit. */
const DEFAULT_ZOOM_IN = 0.8

export function applyCameraPreset(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  preset: CameraPreset,
  points: PatchPoint[],
  meshBox: Box3 | null
): void {
  const center = patchCenter(points)
  _box.copy(combinedBounds(points, meshBox))
  _box.getSize(_size)
  const radius = Math.max(_size.x, _size.y, _size.z, 0.001) * 0.55
  const dist = (radius / Math.tan((camera.fov * Math.PI) / 360)) * FIT_FRAMING * DEFAULT_ZOOM_IN

  let offset: Vector3
  switch (preset) {
    case 'top':
      offset = new Vector3(0, dist, dist * 0.15)
      break
    case 'front':
      offset = new Vector3(0, dist * 0.25, dist)
      break
    case 'side':
      offset = new Vector3(dist, dist * 0.25, dist * 0.15)
      break
    default:
      offset = new Vector3(dist * 0.75, dist * 0.55, dist * 0.85)
  }

  camera.position.copy(center).add(offset)
  camera.near = Math.max(0.001, dist / 200)
  camera.far = dist * 20
  camera.updateProjectionMatrix()
  controls.target.copy(center)
  controls.update()
}

export function fitCamera(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  points: PatchPoint[],
  meshBox: Box3 | null
): void {
  applyCameraPreset(camera, controls, 'fit', points, meshBox)
}
