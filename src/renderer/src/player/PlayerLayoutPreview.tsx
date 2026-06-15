import { LayoutDataPreview } from '@/preview/LayoutDataPreview'

/** Full-height layout preview for Player — patch geometry with live pixel colours. */
export function PlayerLayoutPreview(): React.JSX.Element {
  return (
    <div className="player-layout-preview">
      <LayoutDataPreview />
    </div>
  )
}
