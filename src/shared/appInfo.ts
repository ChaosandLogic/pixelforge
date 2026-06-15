export const APP_NAME = 'PixelForge'
export const APP_EDITOR_NAME = 'PixelForge Editor'
export const APP_PLAYER_NAME = 'PixelForge Player'

export const APP_TAGLINE =
  'Node-based LED sequencer with sACN output, 3D visualisation, and live effect authoring.'

export const APP_ABOUT_LINES = [
  'Author patches and node-graph effects in the Editor.',
  'Output via sACN (E1.31), Art-Net, or DDP.',
  'Preview on imported layouts with a 3D visualiser.',
  'Export portable show folders for PixelForge Player on site.'
] as const

export const APP_COPYRIGHT = 'Copyright © 2026 PixelForge'

export const KEYBOARD_SHORTCUTS = [
  { keys: 'Cmd/Ctrl+Z', action: 'Undo' },
  { keys: 'Shift+Cmd/Ctrl+Z', action: 'Redo' },
  { keys: '] or →', action: 'Advance sequence segment' },
  { keys: 'Home / Shift+←', action: 'Reset sequence' }
] as const
