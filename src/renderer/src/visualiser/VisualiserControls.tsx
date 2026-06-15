import type { RefObject } from 'react'
import { useVisualiserStore } from '@/store/visualiserStore'
import type { CameraPreset } from './cameraPresets'
import type { VisualiserScene } from './VisualiserScene'

const PRESETS: { id: CameraPreset; label: string }[] = [
  { id: 'fit', label: 'Fit' },
  { id: 'top', label: 'Top' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' }
]

export function VisualiserControls({
  sceneRef
}: {
  sceneRef: RefObject<VisualiserScene | null>
}): React.JSX.Element {
  const stlName = useVisualiserStore((s) => s.stlName)
  const meshVisible = useVisualiserStore((s) => s.meshVisible)
  const pixelSize = useVisualiserStore((s) => s.pixelSize)
  const loadError = useVisualiserStore((s) => s.loadError)
  const setStl = useVisualiserStore((s) => s.setStl)
  const setMeshVisible = useVisualiserStore((s) => s.setMeshVisible)
  const setPixelSize = useVisualiserStore((s) => s.setPixelSize)

  const loadStl = async (): Promise<void> => {
    const path = await window.pixelforge.pickStlFile()
    if (path === null) return
    setStl(path)
  }

  const clearStl = (): void => setStl(null)

  const autoSize = (): void => {
    const size = sceneRef.current?.suggestPixelSize()
    if (size !== undefined) setPixelSize(size)
  }

  const setPreset = (preset: CameraPreset): void => {
    sceneRef.current?.setCameraPreset(preset)
  }

  return (
    <div className="visualiser-controls">
      <div className="visualiser-controls-row">
        <button className="tool-btn visualiser-btn" onClick={() => void loadStl()} title="Load reference STL">
          STL…
        </button>
        {stlName !== null && (
          <>
            <span className="visualiser-stl-name" title={stlName}>
              {stlName}
            </span>
            <button className="tool-btn visualiser-btn" onClick={clearStl} title="Remove STL">
              ×
            </button>
          </>
        )}
      </div>

      <div className="visualiser-controls-row">
        <label className="visualiser-check">
          <input
            type="checkbox"
            checked={meshVisible}
            disabled={stlName === null}
            onChange={(e) => setMeshVisible(e.target.checked)}
          />
          Mesh
        </label>
        <label className="visualiser-slider">
          <span>Size</span>
          <input
            type="range"
            min={0.002}
            max={0.15}
            step={0.001}
            value={pixelSize}
            onChange={(e) => setPixelSize(Number(e.target.value))}
          />
        </label>
        <button className="tool-btn visualiser-btn" onClick={autoSize} title="Auto pixel size from scene bounds">
          Auto
        </button>
      </div>

      <div className="visualiser-controls-row">
        {PRESETS.map((p) => (
          <button key={p.id} className="tool-btn visualiser-btn" onClick={() => setPreset(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {loadError !== null && <div className="visualiser-error">{loadError}</div>}
    </div>
  )
}
