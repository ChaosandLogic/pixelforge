import { useEffect, useState } from 'react'
import { AboutDialog } from '@/ui/AboutDialog'
import { NodeGraph } from '@/graph/NodeGraph'
import { PatchPanel } from '@/patch/PatchPanel'
import { PreviewPanel } from '@/preview/PreviewPanel'
import { Inspector } from '@/ui/Inspector'
import { NetworkPanel } from '@/ui/NetworkPanel'
import { OnboardingDialog } from '@/ui/OnboardingDialog'
import { OutputDiagnosticsPanel } from '@/ui/OutputDiagnosticsPanel'
import { StatusBar } from '@/ui/StatusBar'
import { Toolbar } from '@/ui/Toolbar'

type AboutMode = 'about' | 'shortcuts' | null

export function App(): React.JSX.Element {
  const [aboutMode, setAboutMode] = useState<AboutMode>(null)

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      const data = event.data as { type?: string } | undefined
      if (data?.type === 'pixelforge-show-about') setAboutMode('about')
      if (data?.type === 'pixelforge-show-shortcuts') setAboutMode('shortcuts')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <>
      <div className="app">
        <Toolbar
          onShowAbout={() => setAboutMode('about')}
          onShowShortcuts={() => setAboutMode('shortcuts')}
        />
        <div className="app-body">
          <div className="left-column">
            <NetworkPanel />
            <PatchPanel />
            <OutputDiagnosticsPanel />
          </div>
          <main className="app-main">
            <NodeGraph />
          </main>
          <div className="side-column">
            <PreviewPanel />
            <Inspector />
          </div>
        </div>
        <StatusBar />
        <OnboardingDialog />
      </div>
      <AboutDialog product="editor" mode={aboutMode} onClose={() => setAboutMode(null)} />
    </>
  )
}
