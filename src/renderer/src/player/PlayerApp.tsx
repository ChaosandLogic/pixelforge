import { useEffect, useState } from 'react'
import type { ProjectFile } from '@shared/project'
import { AboutDialog } from '@/ui/AboutDialog'
import { NetworkPanel } from '@/ui/NetworkPanel'
import { OutputDiagnosticsPanel } from '@/ui/OutputDiagnosticsPanel'
import { StatusBar } from '@/ui/StatusBar'
import { PlayerLayoutPreview } from '@/player/PlayerLayoutPreview'
import { PlayerOutputPanel } from '@/player/PlayerOutputPanel'
import { PlayerStartupPanel } from '@/player/PlayerStartupPanel'
import { useEngineStore } from '@/store/engineStore'
import { loadProjectIntoStores } from '@/project/loadProject'

type AboutMode = 'about' | 'shortcuts' | null

function PlayerShell({
  projectName,
  onProjectNameChange,
  onShowAbout,
  onShowStartup
}: {
  projectName: string
  onProjectNameChange: (name: string) => void
  onShowAbout: () => void
  onShowStartup: () => void
}): React.JSX.Element {
  const setOutputActive = useEngineStore((s) => s.setOutputActive)
  const outputActive = useEngineStore((s) => s.status.outputActive)

  const loadProject = (project: ProjectFile, autoOutput = false): void => {
    loadProjectIntoStores(project)
    onProjectNameChange(project.meta.name)
    if (autoOutput) setOutputActive(true)
  }

  const openShow = async (): Promise<void> => {
    if (window.pixelforgePlayer === undefined) return
    const project = await window.pixelforgePlayer.openProject()
    if (project !== null) loadProject(project)
  }

  useEffect(() => {
    if (window.pixelforgePlayer === undefined) return
    void window.pixelforgePlayer.getBootStatus().then(({ project, autoOutput }) => {
      if (project !== null) loadProject(project, autoOutput)
    })
  }, [])

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      const data = event.data as { type?: string } | undefined
      if (data?.type === 'pixelforge-open-show') void openShow()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <div className="app player-app">
      <header className="toolbar">
        <div className="brand">
          <span className="brand-mark" />
          PixelForge Player
        </div>
        <div className="toolbar-controls">
          <span className="tool-label">{projectName}</span>
          <button className="tool-btn" onClick={() => void openShow()}>
            Open Show
          </button>
          <button className="tool-btn" onClick={onShowStartup} title="Configure show to load at startup">
            Startup Show
          </button>
          <button
            className={`tool-btn ${outputActive ? 'active' : ''}`}
            onClick={() => setOutputActive(!outputActive)}
          >
            {outputActive ? 'Output ON' : 'Output OFF'}
          </button>
          <button className="tool-btn" onClick={onShowAbout} title="About PixelForge Player">
            About
          </button>
        </div>
      </header>
      <div className="app-body player-body">
        <div className="left-column player-sidebar">
          <NetworkPanel />
          <PlayerOutputPanel />
          <OutputDiagnosticsPanel />
        </div>
        <main className="app-main player-preview">
          <PlayerLayoutPreview />
        </main>
      </div>
      <StatusBar />
    </div>
  )
}

export function PlayerApp(): React.JSX.Element {
  const [aboutMode, setAboutMode] = useState<AboutMode>(null)
  const [startupOpen, setStartupOpen] = useState(false)
  const [projectName, setProjectName] = useState('No show loaded')

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      const data = event.data as { type?: string } | undefined
      if (data?.type === 'pixelforge-show-about') setAboutMode('about')
      if (data?.type === 'pixelforge-show-shortcuts') setAboutMode('shortcuts')
      if (data?.type === 'pixelforge-show-startup-panel') setStartupOpen(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <>
      <PlayerShell
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onShowAbout={() => setAboutMode('about')}
        onShowStartup={() => setStartupOpen(true)}
      />
      <AboutDialog product="player" mode={aboutMode} onClose={() => setAboutMode(null)} />
      <PlayerStartupPanel
        open={startupOpen}
        onClose={() => setStartupOpen(false)}
        onApplied={setProjectName}
      />
    </>
  )
}
