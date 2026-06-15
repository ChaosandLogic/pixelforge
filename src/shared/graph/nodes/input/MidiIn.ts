import { type NodeTypeDef } from '../../types'

export const MIDI_IN_NODE_TYPE = 'input/midi-in'

export const MidiIn: NodeTypeDef = {
  type: MIDI_IN_NODE_TYPE,
  label: 'MIDI In',
  category: 'time',
  description: 'MIDI note or CC as float; trigger on note-on',
  inputs: [],
  outputs: [
    { name: 'value', label: 'Value', type: 'float' },
    { name: 'velocity', label: 'Velocity', type: 'float' },
    { name: 'trigger', label: 'Trigger', type: 'trigger' }
  ],
  params: [
    {
      name: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'note',
      options: ['note', 'cc']
    },
    { name: 'channel', label: 'Channel', type: 'int', default: 0, min: 0, max: 15 },
    { name: 'number', label: 'Note/CC', type: 'int', default: 60, min: 0, max: 127 },
    { name: 'device', label: 'Device', type: 'string', default: '' }
  ],
  evaluate(_inputs, _params, ctx) {
    const state = ctx.getMidiState(ctx.nodeId)
    const value = state?.value ?? 0
    const velocity = state?.velocity ?? 0
    const gate = state?.gate ?? 0
    ctx.pulseTrigger('trigger', gate, 0.5)
    return { value, velocity }
  }
}

export const MIDI_INLINE_PARAMS = new Set(['mode', 'channel', 'number', 'device'])
