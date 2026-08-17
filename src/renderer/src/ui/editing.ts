import { useGraphStore } from '@/store/graphStore'

export type EditCommand = 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll'

export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/** Graph edit when the canvas is focused; native text commands inside inputs. */
export function handleEditCommand(command: EditCommand): void {
  if (isTextEditingTarget(document.activeElement)) {
    window.pixelforge.nativeEdit(command)
    return
  }

  const graph = useGraphStore.getState()
  if (command === 'undo') graph.undo()
  else if (command === 'redo') graph.redo()
  else if (command === 'copy') graph.copySelectedNodes()
  else if (command === 'paste') graph.pasteNodes()
  else if (command === 'cut') {
    graph.copySelectedNodes()
    graph.removeSelectedNodes()
  } else {
    graph.selectAllNodes()
  }
}
