export const APP_NAME = 'PixelForge'
export const APP_EDITOR_NAME = 'PixelForge Editor'
export const APP_PLAYER_NAME = 'PixelForge Player'

/** Which application this process is — used for update channels, Sentry release
 * tags, and window/menu naming. */
export type Product = 'editor' | 'player'

export const APP_TAGLINE =
  'Node-based LED sequencer with sACN output, 3D visualisation, and live effect authoring.'

export const APP_ABOUT_LINES = [
  'Author patches and node-graph effects in the Editor.',
  'Output via sACN (E1.31), Art-Net, DDP, Syphon, or Spout.',
  'Preview on imported layouts with a 3D visualiser.',
  'Export portable show folders for PixelForge Player on site.'
] as const

export const APP_COPYRIGHT = 'Copyright © 2026 PixelForge'

export const KEYBOARD_SHORTCUTS = [
  { keys: 'Cmd/Ctrl+N', action: 'New project' },
  { keys: 'Cmd/Ctrl+O', action: 'Open project / show' },
  { keys: 'Cmd/Ctrl+S', action: 'Save' },
  { keys: 'Shift+Cmd/Ctrl+S', action: 'Save As' },
  { keys: 'Cmd/Ctrl+Z', action: 'Undo' },
  { keys: 'Shift+Cmd/Ctrl+Z', action: 'Redo' },
  { keys: 'Cmd/Ctrl+X', action: 'Cut selected nodes' },
  { keys: 'Cmd/Ctrl+C', action: 'Copy selected nodes' },
  { keys: 'Cmd/Ctrl+V', action: 'Paste nodes' },
  { keys: 'Cmd/Ctrl+A', action: 'Select all nodes' },
  { keys: 'Backspace / Delete', action: 'Delete selected nodes' },
  { keys: '] or →', action: 'Advance sequence segment' },
  { keys: 'Home / Shift+←', action: 'Reset sequence' },
  { keys: 'Cmd/Ctrl+/', action: 'Keyboard shortcuts' }
] as const
