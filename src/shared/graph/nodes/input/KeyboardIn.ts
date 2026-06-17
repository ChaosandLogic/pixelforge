import { type NodeTypeDef } from '../../types'

export const KEYBOARD_IN_NODE_TYPE = 'input/keyboard-in'

export const KeyboardIn: NodeTypeDef = {
  type: KEYBOARD_IN_NODE_TYPE,
  label: 'Keyboard In',
  category: 'time',
  description: 'Fire a trigger when a key is pressed (works in Editor and Player)',
  inputs: [],
  outputs: [
    { name: 'trigger', label: 'Trigger', type: 'trigger' },
    { name: 'gate', label: 'Gate', type: 'float' }
  ],
  params: [
    { name: 'key', label: 'Key', type: 'string', default: 'Enter' },
    { name: 'shift', label: 'Shift', type: 'boolean', default: false },
    { name: 'ctrl', label: 'Ctrl', type: 'boolean', default: false },
    { name: 'alt', label: 'Alt', type: 'boolean', default: false },
    { name: 'meta', label: 'Cmd/Meta', type: 'boolean', default: false }
  ],
  evaluate(_inputs, _params, ctx) {
    const state = ctx.getKeyboardState(ctx.nodeId)
    const gate = state?.gate ?? 0
    ctx.pulseTrigger('trigger', gate, 0.5)
    return { gate }
  }
}

export const KEYBOARD_INLINE_PARAMS = new Set(['key', 'shift', 'ctrl', 'alt', 'meta'])
