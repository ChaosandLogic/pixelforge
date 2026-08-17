import { useEffect, useState } from 'react'
import { AboutDialog } from '@/ui/AboutDialog'
import { handleEditCommand, type EditCommand } from '@/ui/editing'
import { NodeGraph } from '@/graph/NodeGraph'
import { PatchPanel } from '@/patch/PatchPanel'
import { PreviewPanel } from '@/preview/PreviewPanel'
import { Inspector } from '@/ui/Inspector'
import { NetworkPanel } from '@/ui/NetworkPanel'
import { OnboardingDialog } from '@/ui/OnboardingDialog'
import { OutputDiagnosticsPanel } from '@/ui/OutputDiagnosticsPanel'
import { StatusBar } from '@/ui/StatusBar'
import { Toolbar } from '@/ui/Toolbar'
import { newProject, openProject, saveProject } from '@/project/projectActions'

type AboutMode = 'about' | 'shortcuts' | null

const EDIT_MESSAGES: Record<string, EditCommand> = {
  'pixelforge-edit-undo': 'undo',
  'pixelforge-edit-redo': 'redo',
  'pixelforge-edit-cut': 'cut',
  'pixelforge-edit-copy': 'copy',
  'pixelforge-edit-paste': 'paste',
  'pixelforge-edit-select-all': 'selectAll'
}

export function App(): React.JSX.Element {
  const [aboutMode, setAboutMode] = useState<AboutMode>(null)

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      const data = event.data as { type?: string } | undefined
      const type = data?.type
      if (type === undefined) return
      if (type === 'pixelforge-show-about') setAboutMode('about')
      if (type === 'pixelforge-show-shortcuts') setAboutMode('shortcuts')
      if (type === 'pixelforge-new-project') void newProject()
      if (type === 'pixelforge-open-project') void openProject()
      if (type === 'pixelforge-save-project') void saveProject(false)
      if (type === 'pixelforge-save-project-as') void saveProject(true)
      const edit = EDIT_MESSAGES[type]
      if (edit !== undefined) handleEditCommand(edit)
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
