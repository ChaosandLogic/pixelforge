import { useEffect, useRef } from 'react'
import { MAX_PIXELS } from '@shared/messages'
import { useEngineStore } from '@/store/engineStore'
import { usePatchStore } from '@/store/patchStore'
import { useVisualiserStore } from '@/store/visualiserStore'
import { VisualiserControls } from './VisualiserControls'
import { VisualiserScene } from './VisualiserScene'

async function loadStlPath(scene: VisualiserScene, path: string): Promise<void> {
  try {
    const data = await window.pixelforge.readMediaFile(path)
    await scene.loadStl(data)
    useVisualiserStore.getState().setLoadError(null)
  } catch (err) {
    useVisualiserStore.getState().setLoadError(err instanceof Error ? err.message : String(err))
  }
}

/**
 * Three.js 3D preview: InstancedMesh pixel spheres on patch positions,
 * optional reference STL mesh, orbit controls.
 */
export function Visualiser(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<VisualiserScene | null>(null)

  const points = usePatchStore((s) => s.points)
  const stlPath = useVisualiserStore((s) => s.stlPath)
  const meshVisible = useVisualiserStore((s) => s.meshVisible)
  const pixelSize = useVisualiserStore((s) => s.pixelSize)

  // Bootstrap Three.js scene once.
  useEffect(() => {
    const container = containerRef.current
    if (container === null) return

    const scene = new VisualiserScene(container, MAX_PIXELS)
    sceneRef.current = scene
    scene.setPatchPoints(usePatchStore.getState().points)
    scene.setMeshVisible(useVisualiserStore.getState().meshVisible)
    scene.setPixelSize(useVisualiserStore.getState().pixelSize)

    const initialStl = useVisualiserStore.getState().stlPath
    if (initialStl !== null) void loadStlPath(scene, initialStl)

    const observer = new ResizeObserver(() => {
      scene.resize(container.clientWidth, container.clientHeight)
    })
    observer.observe(container)

    let raf = 0
    const tick = (): void => {
      const { frame, framePixelCount } = useEngineStore.getState()
      scene.renderFrame(frame, framePixelCount)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  // Patch geometry changes.
  useEffect(() => {
    sceneRef.current?.setPatchPoints(points)
  }, [points])

  useEffect(() => {
    sceneRef.current?.setMeshVisible(meshVisible)
  }, [meshVisible])

  useEffect(() => {
    sceneRef.current?.setPixelSize(pixelSize)
  }, [pixelSize])

  // Load / reload STL when path changes.
  useEffect(() => {
    const scene = sceneRef.current
    if (scene === null) return

    if (stlPath === null) {
      scene.removeStl()
      return
    }

    void loadStlPath(scene, stlPath)
  }, [stlPath])

  return (
    <div className="preview-wrap preview-wrap--3d">
      <div ref={containerRef} className="visualiser-canvas-host" />
      <VisualiserControls sceneRef={sceneRef} />
    </div>
  )
}
