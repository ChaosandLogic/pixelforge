/** Weekday index: 0 = Sunday … 6 = Saturday (matches Date.getDay()). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface ScheduleSlot {
  id: string
  label: string
  /** Local start time in 24-hour HH:MM form. */
  time: string
  /** Active weekdays; empty means every day. */
  days: Weekday[]
}

export const MAX_SCHEDULE_SLOTS = 16

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function defaultScheduleSlots(): ScheduleSlot[] {
  return [
    { id: 'morning', label: 'Morning', time: '08:00', days: [1, 2, 3, 4, 5] },
    { id: 'evening', label: 'Evening', time: '18:00', days: [0, 1, 2, 3, 4, 5, 6] }
  ]
}

export function parseScheduleSlots(raw: unknown): ScheduleSlot[] {
  if (!Array.isArray(raw)) return defaultScheduleSlots()
  const slots: ScheduleSlot[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const s = item as Record<string, unknown>
    const daysRaw = s['days']
    const days: Weekday[] = []
    if (Array.isArray(daysRaw)) {
      for (const d of daysRaw) {
        if (typeof d === 'number' && d >= 0 && d <= 6) days.push(d as Weekday)
      }
    }
    slots.push({
      id: typeof s['id'] === 'string' ? s['id'] : `slot${slots.length}`,
      label: typeof s['label'] === 'string' ? s['label'] : `Slot ${slots.length + 1}`,
      time: normaliseTime(typeof s['time'] === 'string' ? s['time'] : '12:00'),
      days
    })
    if (slots.length >= MAX_SCHEDULE_SLOTS) break
  }
  return slots.length > 0 ? slots : defaultScheduleSlots()
}

export function scheduleSlotPortName(index: number): string {
  return `slot_${index}`
}

/** Normalise to HH:MM or fall back to 12:00. */
export function normaliseTime(raw: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim())
  if (m === null) return '12:00'
  const h = Math.max(0, Math.min(23, Number(m[1])))
  const min = Math.max(0, Math.min(59, Number(m[2])))
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Minutes since midnight from HH:MM, or null if invalid. */
export function minutesFromTime(time: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(normaliseTime(time))
  if (m === null) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function slotMatchesDay(slot: ScheduleSlot, day: Weekday): boolean {
  return slot.days.length === 0 || slot.days.includes(day)
}
