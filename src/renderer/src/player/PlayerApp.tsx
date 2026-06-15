import { useEffect, useState } from 'react'
import type { ProjectFile } from '@shared/project'
import { AboutDialog } from '@/ui/AboutDialog'
import { LicenseDialog } from '@/ui/LicenseDialog'
import { LicenseGate } from '@/ui/LicenseGate'
import { NetworkPanel } from '@/ui/NetworkPanel'
import { OutputDiagnosticsPanel } from '@/ui/OutputDiagnosticsPanel'
import { StatusBar } from '@/ui/StatusBar'
import { PlayerLayoutPreview } from '@/player/PlayerLayoutPreview'
import { PlayerOutputPanel } from '@/player/PlayerOutputPanel'
import { useEngineStore } from '@/store/engineStore'
import { loadProjectIntoStores } from '@/project/loadProject'

type AboutMode = 'about' | 'shortcuts' | null

function PlayerShell({
  onShowAbout,
  onShowLicense
}: {
  onShowAbout: () => void
  onShowLicense: () => void
}): React.JSX.Element {
  const [projectName, setProjectName] = useState('No show loaded')
  const setOutputActive = useEngineStore((s) => s.setOutputActive)
  const outputActive = useEngineStore((s) => s.status.outputActive)

  const loadProject = (project: ProjectFile): void => {
    loadProjectIntoStores(project)
    setProjectName(project.meta.name)
  }

  useEffect(() => {
    if (window.pixelforgePlayer === undefined) return
    void window.pixelforgePlayer.loadInitialProject().then((project) => {
      if (project !== null) loadProject(project)
    })
  }, [])

  const openShow = async (): Promise<void> => {
    if (window.pixelforgePlayer === undefined) return
    const project = await window.pixelforgePlayer.openProject()
    if (project !== null) loadProject(project)
  }

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
          <button
            className={`tool-btn ${outputActive ? 'active' : ''}`}
            onClick={() => setOutputActive(!outputActive)}
          >
            {outputActive ? 'Output ON' : 'Output OFF'}
          </button>
          <button className="tool-btn" onClick={onShowLicense} title="License status">
            License
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
  const [licenseOpen, setLicenseOpen] = useState(false)

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      const data = event.data as { type?: string } | undefined
      if (data?.type === 'pixelforge-show-about') setAboutMode('about')
      if (data?.type === 'pixelforge-show-shortcuts') setAboutMode('shortcuts')
      if (data?.type === 'pixelforge-show-license') setLicenseOpen(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <>
      <LicenseGate product="player" api="player">
        <PlayerShell onShowAbout={() => setAboutMode('about')} onShowLicense={() => setLicenseOpen(true)} />
      </LicenseGate>
      <AboutDialog product="player" mode={aboutMode} onClose={() => setAboutMode(null)} />
      <LicenseDialog product="player" api="player" open={licenseOpen} onClose={() => setLicenseOpen(false)} />
    </>
  )
}
