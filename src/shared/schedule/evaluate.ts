import {
  minutesFromTime,
  slotMatchesDay,
  type ScheduleSlot,
  type Weekday
} from './types'

/** Unique key for a slot firing at a given wall-clock minute. */
export function scheduleFireKey(date: Date, slotIndex: number): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-s${slotIndex}`
}

/**
 * Index of the slot whose start time has most recently passed today on this
 * weekday, or -1 if none have started yet.
 */
export function activeSlotIndex(slots: ScheduleSlot[], date: Date): number {
  const day = date.getDay() as Weekday
  const nowMin = date.getHours() * 60 + date.getMinutes()
  let best = -1
  let bestMin = -1

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i] as ScheduleSlot
    if (!slotMatchesDay(slot, day)) continue
    const start = minutesFromTime(slot.time)
    if (start === null || start > nowMin) continue
    if (start >= bestMin) {
      bestMin = start
      best = i
    }
  }
  return best
}

/** True when wall-clock is within the slot's start minute (fires once per minute). */
export function slotStartsThisMinute(slot: ScheduleSlot, date: Date): boolean {
  const day = date.getDay() as Weekday
  if (!slotMatchesDay(slot, day)) return false
  const start = minutesFromTime(slot.time)
  if (start === null) return false
  const nowMin = date.getHours() * 60 + date.getMinutes()
  return nowMin === start
}
