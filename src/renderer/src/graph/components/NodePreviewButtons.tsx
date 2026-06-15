import { getNodeType } from '@shared/graph/registry'
import { isNodePreviewEnabled, nodePreviewView } from '@shared/graph/preview'
import { useGraphStore } from '@/store/graphStore'

interface NodePreviewButtonsProps {
  nodeId: string
  nodeType: string
  /** When false, only the view toggle is shown (preview always visible). */
  showEye?: boolean
}

export function NodePreviewButtons({
  nodeId,
  nodeType,
  showEye = true
}: NodePreviewButtonsProps): React.JSX.Element | null {
  const togglePreview = useGraphStore((s) => s.togglePreview)
  const togglePreviewView = useGraphStore((s) => s.togglePreviewView)
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === nodeId))
  const def = getNodeType(nodeType)
  const primaryOut = def?.outputs[0]
  const previewKind = primaryOut?.type === 'pixels' ? 'pixels' : primaryOut?.type === 'float' ? 'float' : null
  const previewOn = isNodePreviewEnabled(node?.data.preview)
  const previewView = nodePreviewView(node?.data.previewView)

  if (previewKind === null) return null

  return (
    <>
      {previewKind === 'pixels' && (
        <button
          className={previewView === 'output' ? 'pf-preview-view nodrag active' : 'pf-preview-view nodrag'}
          title={
            previewView === 'output'
              ? 'Output view — LED layout (click for patch view)'
              : 'Patch view — stream grid (click for output view)'
          }
          onClick={(e) => {
            e.stopPropagation()
            togglePreviewView(nodeId)
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            {previewView === 'output' ? (
              <>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="12" cy="14" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="16" cy="9" r="1.2" fill="currentColor" stroke="none" />
              </>
            ) : (
              <>
                <rect x="4" y="4" width="7" height="7" rx="1" />
                <rect x="13" y="4" width="7" height="7" rx="1" />
                <rect x="4" y="13" width="7" height="7" rx="1" />
                <rect x="13" y="13" width="7" height="7" rx="1" />
              </>
            )}
          </svg>
        </button>
      )}
      {showEye && (
        <button
          className={previewOn ? 'pf-eye nodrag active' : 'pf-eye nodrag'}
          title={previewOn ? 'Hide preview' : 'Show preview'}
          onClick={(e) => {
            e.stopPropagation()
            togglePreview(nodeId)
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      )}
    </>
  )
}
