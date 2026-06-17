import { useEffect, useState } from 'react'
import type { ParamValue } from '@shared/graph/types'
import { formatKeyboardBinding } from '@/media/KeyboardManager'
import { useGraphStore } from '@/store/graphStore'

interface KeyboardInspectorPanelProps {
  nodeId: string
  params: Record<string, ParamValue>
}

export function KeyboardInspectorPanel({
  nodeId,
  params
}: KeyboardInspectorPanelProps): React.JSX.Element {
  const updateParam = useGraphStore((s) => s.updateParam)
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    if (!capturing) return

    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      updateParam(nodeId, 'key', event.key)
      updateParam(nodeId, 'shift', event.shiftKey)
      updateParam(nodeId, 'ctrl', event.ctrlKey)
      updateParam(nodeId, 'alt', event.altKey)
      updateParam(nodeId, 'meta', event.metaKey)
      setCapturing(false)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [capturing, nodeId, updateParam])

  const binding = formatKeyboardBinding(params)

  return (
    <div className="param-block keyboard-inspector">
      <div className="param-row">
        <label>Key</label>
        <span className="keyboard-binding-label">{binding}</span>
      </div>
      <button
        type="button"
        className={`tool-btn keyboard-set-key${capturing ? ' active' : ''}`}
        onClick={() => setCapturing(true)}
      >
        {capturing ? 'Press a key…' : 'Set key'}
      </button>
      <div className="keyboard-inspector-modifiers">
        {(
          [
            ['shift', 'Shift'],
            ['ctrl', 'Ctrl'],
            ['alt', 'Alt'],
            ['meta', 'Cmd/Meta']
          ] as const
        ).map(([name, label]) => (
          <label key={name} className="keyboard-modifier">
            <input
              type="checkbox"
              checked={params[name] === true}
              onChange={(e) => updateParam(nodeId, name, e.target.checked)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
