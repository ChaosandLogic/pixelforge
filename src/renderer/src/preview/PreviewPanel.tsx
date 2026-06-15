import { useState } from 'react'
import { CanvasPreview } from './CanvasPreview'
import { LayoutDataPreview } from './LayoutDataPreview'
import { Visualiser } from '@/visualiser/Visualiser'

type PreviewTab = 'output' | 'layout' | '3d'

export function PreviewPanel(): React.JSX.Element {
  const [tab, setTab] = useState<PreviewTab>('output')

  return (
    <section className="preview-panel">
      <div className="preview-tabs">
        <button
          className={tab === '3d' ? 'preview-tab active' : 'preview-tab'}
          onClick={() => setTab('3d')}
        >
          3D
        </button>
        <button
          className={tab === 'output' ? 'preview-tab active' : 'preview-tab'}
          onClick={() => setTab('output')}
        >
          Output
        </button>
        <button
          className={tab === 'layout' ? 'preview-tab active' : 'preview-tab'}
          onClick={() => setTab('layout')}
        >
          Layout
        </button>
      </div>
      <div className={tab === '3d' ? 'preview-tab-body preview-tab-body--3d' : 'preview-tab-body'}>
        {tab === '3d' && <Visualiser />}
        {tab === 'output' && <CanvasPreview />}
        {tab === 'layout' && <LayoutDataPreview />}
      </div>
    </section>
  )
}
