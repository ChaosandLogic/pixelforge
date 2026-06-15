import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Mesh,
  PerspectiveCamera,
  Scene,
  WebGLRenderer
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { PatchPoint } from '@shared/patch/types'
import { applyCameraPreset, combinedBounds, defaultPixelSize, type CameraPreset, fitCamera } from './cameraPresets'
import { PixelPoints } from './PixelPoints'
import { centerMesh, disposeStlMesh, loadStlMesh } from './stlLoader'

const BG = 0x0a0d12

export class VisualiserScene {
  readonly scene = new Scene()
  readonly camera: PerspectiveCamera
  readonly renderer: WebGLRenderer
  readonly controls: OrbitControls
  readonly pixels: PixelPoints

  private stlMesh: Mesh | null = null
  private stlBox: Box3 | null = null
  private lastPoints: PatchPoint[] = []
  private meshVisible = true
  private disposed = false

  constructor(container: HTMLElement, maxPixels: number) {
    this.scene.background = new Color(BG)

    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    this.camera = new PerspectiveCamera(45, w / h, 0.01, 500)
    this.camera.position.set(2, 2, 2)

    this.renderer = new WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h, false)
    container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.screenSpacePanning = true

    this.scene.add(new AmbientLight(0xffffff, 0.55))
    const key = new DirectionalLight(0xffffff, 0.85)
    key.position.set(4, 6, 3)
    this.scene.add(key)

    this.pixels = new PixelPoints(maxPixels)
    this.scene.add(this.pixels.mesh)
  }

  setPatchPoints(points: PatchPoint[]): void {
    this.lastPoints = points
    this.pixels.setPositions(points)
    if (this.stlMesh === null) {
      fitCamera(this.camera, this.controls, points, null)
    } else {
      fitCamera(this.camera, this.controls, points, this.stlBox)
    }
  }

  setPixelSize(size: number): void {
    this.pixels.setPixelSize(size)
  }

  setMeshVisible(visible: boolean): void {
    this.meshVisible = visible
    if (this.stlMesh !== null) this.stlMesh.visible = visible
  }

  async loadStl(data: ArrayBuffer): Promise<void> {
    this.removeStl()
    const mesh = loadStlMesh(data)
    this.stlBox = centerMesh(mesh)
    mesh.visible = this.meshVisible
    this.stlMesh = mesh
    this.scene.add(mesh)
    fitCamera(this.camera, this.controls, this.lastPoints, this.stlBox)
  }

  removeStl(): void {
    if (this.stlMesh !== null) {
      this.scene.remove(this.stlMesh)
      disposeStlMesh(this.stlMesh)
      this.stlMesh = null
      this.stlBox = null
    }
  }

  setCameraPreset(preset: CameraPreset): void {
    applyCameraPreset(this.camera, this.controls, preset, this.lastPoints, this.stlBox)
  }

  fitView(): void {
    fitCamera(this.camera, this.controls, this.lastPoints, this.stlBox)
  }

  suggestPixelSize(): number {
    return defaultPixelSize(combinedBounds(this.lastPoints, this.stlBox))
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, width)
    const h = Math.max(1, height)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  renderFrame(frame: Uint8Array | null, pixelCount: number): void {
    this.pixels.updateColors(frame, pixelCount)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.removeStl()
    this.pixels.dispose()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
