import { useEffect, useState } from 'react'
import { AboutDialog } from '@/ui/AboutDialog'
import { LicenseDialog } from '@/ui/LicenseDialog'
import { NodeGraph } from '@/graph/NodeGraph'
import { PatchPanel } from '@/patch/PatchPanel'
import { PreviewPanel } from '@/preview/PreviewPanel'
import { Inspector } from '@/ui/Inspector'
import { LicenseGate } from '@/ui/LicenseGate'
import { NetworkPanel } from '@/ui/NetworkPanel'
import { OnboardingDialog } from '@/ui/OnboardingDialog'
import { OutputDiagnosticsPanel } from '@/ui/OutputDiagnosticsPanel'
import { StatusBar } from '@/ui/StatusBar'
import { Toolbar } from '@/ui/Toolbar'

type AboutMode = 'about' | 'shortcuts' | null

export function App(): React.JSX.Element {
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
      <LicenseGate product="editor" api="editor">
        <div className="app">
          <Toolbar
            onShowAbout={() => setAboutMode('about')}
            onShowShortcuts={() => setAboutMode('shortcuts')}
            onShowLicense={() => setLicenseOpen(true)}
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
      </LicenseGate>
      <AboutDialog product="editor" mode={aboutMode} onClose={() => setAboutMode(null)} />
      <LicenseDialog product="editor" api="editor" open={licenseOpen} onClose={() => setLicenseOpen(false)} />
    </>
  )
}
