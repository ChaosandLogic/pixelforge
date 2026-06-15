import { useEffect, useRef, useState } from 'react'
import { createProjectFile, type ExampleManifestEntry, type ProjectFile } from '@shared/project'
import { useEngineStore } from '@/store/engineStore'
import { useGraphStore } from '@/store/graphStore'
import { usePatchStore } from '@/store/patchStore'
import { useUiStore } from '@/store/uiStore'
import { useVisualiserStore } from '@/store/visualiserStore'
import { loadProjectIntoStores } from '@/project/loadProject'

function loadProject(project: ProjectFile): void {
  loadProjectIntoStores(project)
  useVisualiserStore.getState().loadSettings(project.visualiser)
}

export function Toolbar({
  onShowAbout,
  onShowShortcuts,
  onShowLicense
}: {
  onShowAbout: () => void
  onShowShortcuts: () => void
  onShowLicense: () => void
}): React.JSX.Element {
  const status = useEngineStore((s) => s.status)
  const setOutputActive = useEngineStore((s) => s.setOutputActive)
  const undo = useGraphStore((s) => s.undo)
  const redo = useGraphStore((s) => s.redo)
  const canUndo = useGraphStore((s) => s.past.length > 0)
  const canRedo = useGraphStore((s) => s.future.length > 0)
  const profilerEnabled = useUiStore((s) => s.profilerEnabled)
  const setProfilerEnabled = useUiStore((s) => s.setProfilerEnabled)

  const [examples, setExamples] = useState<ExampleManifestEntry[]>([])
  const [examplesOpen, setExamplesOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const examplesRef = useRef<HTMLDivElement>(null)
  const helpRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.pixelforge.listExamples().then(setExamples)
  }, [])

  useEffect(() => {
    if (!examplesOpen) return
    const onDoc = (e: MouseEvent): void => {
      if (examplesRef.current?.contains(e.target as Node)) return
      setExamplesOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [examplesOpen])

  useEffect(() => {
    if (!helpOpen) return
    const onDoc = (e: MouseEvent): void => {
      if (helpRef.current?.contains(e.target as Node)) return
      setHelpOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [helpOpen])

  const saveProject = async (): Promise<void> => {
    const graph = useGraphStore.getState().toGraphData()
    const { points, layout } = usePatchStore.getState()
    const patch = layout !== null ? { points, layout } : { points }
    const project = {
      ...createProjectFile('untitled', graph, patch, useEngineStore.getState().config),
      visualiser: useVisualiserStore.getState().toSettings()
    }
    await window.pixelforge.saveProject(project)
  }

  const exportShow = async (): Promise<void> => {
    const graph = useGraphStore.getState().toGraphData()
    const { points, layout } = usePatchStore.getState()
    const patch = layout !== null ? { points, layout } : { points }
    const project = {
      ...createProjectFile('untitled', graph, patch, useEngineStore.getState().config),
      visualiser: useVisualiserStore.getState().toSettings()
    }
    const result = await window.pixelforge.exportShow(project)
    if (result !== null) {
      alert(`Show exported to ${result.outputDir}`)
    }
  }

  const openProject = async (): Promise<void> => {
    const project = await window.pixelforge.openProject()
    if (project === null) return
    loadProject(project)
  }

  const openExample = async (filename: string): Promise<void> => {
    const project = await window.pixelforge.openExample(filename)
    if (project === null) return
    loadProject(project)
    setExamplesOpen(false)
  }

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark" />
        PixelForge
      </div>

      <div className="toolbar-controls">
        <div className="btn-group">
          <button className="tool-btn" onClick={() => void openProject()} title="Open project">
            Open
          </button>
          <button className="tool-btn" onClick={() => void saveProject()} title="Save project">
            Save
          </button>
          <button className="tool-btn" onClick={() => void exportShow()} title="Export portable show folder for Player">
            Export Show
          </button>
        </div>

        {examples.length > 0 && (
          <div className="examples-menu" ref={examplesRef}>
            <button
              className={examplesOpen ? 'tool-btn active' : 'tool-btn'}
              onClick={() => setExamplesOpen(!examplesOpen)}
              title="Load a bundled example patch"
            >
              Examples ▾
            </button>
            {examplesOpen && (
              <div className="examples-list">
                {examples.map((ex) => (
                  <button
                    key={ex.filename}
                    className="examples-item"
                    title={ex.description}
                    onClick={() => void openExample(ex.filename)}
                  >
                    <span className="examples-item-name">{ex.name}</span>
                    <span className="examples-item-desc">{ex.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="btn-group">
          <button className="tool-btn" onClick={undo} disabled={!canUndo} title="Undo (Cmd+Z)">
            ↩
          </button>
          <button className="tool-btn" onClick={redo} disabled={!canRedo} title="Redo (Shift+Cmd+Z)">
            ↪
          </button>
        </div>

        <button
          className={profilerEnabled ? 'output-btn active' : 'output-btn'}
          onClick={() => setProfilerEnabled(!profilerEnabled)}
          title="Show per-node evaluate timings on all nodes"
        >
          {profilerEnabled ? 'Profiler ON' : 'Profiler OFF'}
        </button>

        <div className="examples-menu" ref={helpRef}>
          <button
            className={helpOpen ? 'tool-btn active' : 'tool-btn'}
            onClick={() => setHelpOpen(!helpOpen)}
            title="Help and about"
          >
            Help ▾
          </button>
          {helpOpen && (
            <div className="examples-list help-list">
              <button
                className="examples-item"
                onClick={() => {
                  setHelpOpen(false)
                  onShowLicense()
                }}
              >
                <span className="examples-item-name">Manage license</span>
                <span className="examples-item-desc">Status, slots, and deactivation</span>
              </button>
              <button
                className="examples-item"
                onClick={() => {
                  setHelpOpen(false)
                  onShowAbout()
                }}
              >
                <span className="examples-item-name">About PixelForge</span>
                <span className="examples-item-desc">Version, licensing, and features</span>
              </button>
              <button
                className="examples-item"
                onClick={() => {
                  setHelpOpen(false)
                  onShowShortcuts()
                }}
              >
                <span className="examples-item-name">Keyboard shortcuts</span>
                <span className="examples-item-desc">Undo, redo, sequence controls</span>
              </button>
            </div>
          )}
        </div>

        <button
          className={status.outputActive ? 'output-btn active' : 'output-btn'}
          onClick={() => setOutputActive(!status.outputActive)}
        >
          {status.outputActive ? 'Output ON' : 'Output OFF'}
        </button>
      </div>
    </header>
  )
}
