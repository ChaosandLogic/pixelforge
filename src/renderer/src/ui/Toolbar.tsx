import { useEffect, useRef, useState } from 'react'
import { createProjectFile, type ExampleManifestEntry, type ProjectFile } from '@shared/project'
import { useEngineStore } from '@/store/engineStore'
import { useGraphStore } from '@/store/graphStore'
import { usePatchStore } from '@/store/patchStore'
import { useUiStore } from '@/store/uiStore'
import { useVisualiserStore } from '@/store/visualiserStore'
import { loadProjectIntoStores } from '@/project/loadProject'
import { ExportShowDialog } from '@/ui/ExportShowDialog'
import { ExportEspDialog } from '@/ui/ExportEspDialog'
import { ExportFseqDialog } from '@/ui/ExportFseqDialog'
import type { ShowStartupHints } from '@shared/playerStartup'

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
  const config = useEngineStore((s) => s.config)
  const profilerEnabled = useUiStore((s) => s.profilerEnabled)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportEspOpen, setExportEspOpen] = useState(false)
  const [exportFseqOpen, setExportFseqOpen] = useState(false)
  const setProfilerEnabled = useUiStore((s) => s.setProfilerEnabled)

  const [examples, setExamples] = useState<ExampleManifestEntry[]>([])
  const [examplesOpen, setExamplesOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const examplesRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)
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
    if (!exportMenuOpen) return
    const onDoc = (e: MouseEvent): void => {
      if (exportRef.current?.contains(e.target as Node)) return
      setExportMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [exportMenuOpen])

  useEffect(() => {
    if (!helpOpen) return
    const onDoc = (e: MouseEvent): void => {
      if (helpRef.current?.contains(e.target as Node)) return
      setHelpOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [helpOpen])

  const buildProjectFile = (): ProjectFile => {
    const graph = useGraphStore.getState().toGraphData()
    const { points, layout } = usePatchStore.getState()
    const patch = layout !== null ? { points, layout } : { points }
    // Preserve the loaded project's name/created timestamp instead of resetting
    // to "untitled" and a fresh date on every save.
    const meta = useUiStore.getState().projectMeta
    return {
      ...createProjectFile(meta?.name ?? 'untitled', graph, patch, useEngineStore.getState().config, meta?.created),
      visualiser: useVisualiserStore.getState().toSettings()
    }
  }

  const saveProject = async (): Promise<void> => {
    const project = buildProjectFile()
    try {
      const savedPath = await window.pixelforge.saveProject(project)
      if (savedPath !== null) {
        const base = savedPath.replace(/^.*[\\/]/, '').replace(/\.pxf$/i, '')
        useUiStore.getState().setProjectMeta({ name: base, created: project.meta.created })
      }
    } catch (err) {
      alert(`Failed to save project: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const exportShow = async (startup?: ShowStartupHints): Promise<void> => {
    const project = buildProjectFile()
    try {
      const result = await window.pixelforge.exportShow(project, startup)
      if (result !== null) {
        alert(`Show exported to ${result.outputDir}`)
      }
    } catch (err) {
      alert(`Failed to export show: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const openProject = async (): Promise<void> => {
    try {
      const project = await window.pixelforge.openProject()
      if (project === null) return
      loadProject(project)
    } catch (err) {
      alert(`Failed to open project: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const openExample = async (filename: string): Promise<void> => {
    try {
      const project = await window.pixelforge.openExample(filename)
      if (project === null) return
      loadProject(project)
      setExamplesOpen(false)
    } catch (err) {
      alert(`Failed to open example: ${err instanceof Error ? err.message : String(err)}`)
    }
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
          <div className="examples-menu" ref={exportRef}>
            <button
              className={exportMenuOpen ? 'tool-btn active' : 'tool-btn'}
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              title="Export show or baked animation"
            >
              Export ▾
            </button>
            {exportMenuOpen && (
              <div className="examples-list export-list">
                <button
                  className="examples-item"
                  onClick={() => {
                    setExportMenuOpen(false)
                    setExportOpen(true)
                  }}
                >
                  <span className="examples-item-name">PixelForge Player</span>
                  <span className="examples-item-desc">Portable show folder for live playback</span>
                </button>
                <button
                  className="examples-item"
                  onClick={() => {
                    setExportMenuOpen(false)
                    setExportEspOpen(true)
                  }}
                >
                  <span className="examples-item-name">ESP32 (ESPixel)</span>
                  <span className="examples-item-desc">Baked ALED .bin for ESPixel firmware</span>
                </button>
                <button
                  className="examples-item"
                  onClick={() => {
                    setExportMenuOpen(false)
                    setExportFseqOpen(true)
                  }}
                >
                  <span className="examples-item-name">Falcon Player (FSEQ)</span>
                  <span className="examples-item-desc">Baked .fseq sequence for FPP</span>
                </button>
              </div>
            )}
          </div>
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
      <ExportShowDialog
        open={exportOpen}
        interfaceAddress={config.iface}
        onClose={() => setExportOpen(false)}
        onConfirm={(startup) => void exportShow(startup)}
      />
      <ExportEspDialog open={exportEspOpen} onClose={() => setExportEspOpen(false)} />
      <ExportFseqDialog open={exportFseqOpen} onClose={() => setExportFseqOpen(false)} />
    </header>
  )
}
