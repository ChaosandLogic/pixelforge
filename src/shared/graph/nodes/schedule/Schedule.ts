import {
  activeSlotIndex,
  scheduleFireKey,
  slotStartsThisMinute
} from '../../../schedule/evaluate'
import {
  defaultScheduleSlots,
  parseScheduleSlots,
  scheduleSlotPortName,
  type ScheduleSlot
} from '../../../schedule/types'
import { type NodeTypeDef, type PortDef } from '../../types'

export const SCHEDULE_NODE_TYPE = 'schedule/schedule'

function slotOutputs(): PortDef[] {
  const outputs: PortDef[] = [{ name: 'index', label: 'Active slot', type: 'float' }]
  for (let i = 0; i < defaultScheduleSlots().length; i++) {
    outputs.push({ name: scheduleSlotPortName(i), label: `Slot ${i + 1}`, type: 'trigger' })
  }
  return outputs
}

export function activeScheduleOutputs(slots: ScheduleSlot[]): PortDef[] {
  const outputs: PortDef[] = [{ name: 'index', label: 'Active slot', type: 'float' }]
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i] as ScheduleSlot
    outputs.push({ name: scheduleSlotPortName(i), label: slot.label, type: 'trigger' })
  }
  return outputs
}

/**
 * Wall-clock schedule: fires trigger outputs when each slot's start time is
 * reached on matching weekdays. Uses local system time (not graph timeMs).
 *
 * Wire slot triggers into Sequence clock/reset, Hold/Ramp triggers, etc.
 * The index float output holds the currently active slot (by latest passed
 * start time today), useful for Switch / SwitchFloat routing.
 */
export const Schedule: NodeTypeDef = {
  type: SCHEDULE_NODE_TYPE,
  label: 'Schedule',
  category: 'time',
  description: 'Fire triggers at scheduled local times on selected weekdays',
  inputs: [],
  outputs: slotOutputs(),
  params: [
    { name: 'enabled', label: 'Enabled', type: 'boolean', default: true },
    { name: 'slots', label: 'Slots', type: 'schedule', default: defaultScheduleSlots() }
  ],
  evaluate(_inputs, params, ctx) {
    const enabled = params['enabled'] !== false
    const slots = parseScheduleSlots(params['slots'])
    const now = new Date()

    const active = enabled ? activeSlotIndex(slots, now) : -1

    if (enabled) {
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i] as ScheduleSlot
        if (!slotStartsThisMinute(slot, now)) continue
        const key = scheduleFireKey(now, i)
        if (ctx.markScheduleFired(ctx.nodeId, i, key)) {
          ctx.emitTrigger(scheduleSlotPortName(i))
        }
      }
    }

    return { index: active }
  }
}
