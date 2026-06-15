/** Standard node preview raster size. */
export const NODE_PREVIEW_SIZE = 128

/** Max thumbnail width in graph node previews (display scale cap). */
export const MAX_PREVIEW_DISPLAY_W = 300
/** Max thumbnail height in graph node previews (display scale cap). */
export const MAX_PREVIEW_DISPLAY_H = 300

/** Fixed square size for all node preview canvases. */
export function previewDisplaySize(): { w: number; h: number } {
  const s = Math.min(NODE_PREVIEW_SIZE, MAX_PREVIEW_DISPLAY_W, MAX_PREVIEW_DISPLAY_H)
  return { w: s, h: s }
}
