import { shiftDay } from './dates'
import type { LocalDate } from './storage'
import type { LocalTime } from './tasks'

/** Base time when a Task or Occurrence has none. */
export const DEFAULT_REMINDER_TIME: LocalTime = '09:00'

/** Allowed minute offsets; 0 means at the time. */
export const REMINDER_MINUTES = [0, 15, 30, 60] as const
export type ReminderMinutes =
  (typeof REMINDER_MINUTES)[number]

/** Allowed day offsets before the Task's day. */
export const REMINDER_DAYS = [1, 2] as const
export type ReminderDays = (typeof REMINDER_DAYS)[number]

/** Reminder offset relative to its Task's time or day. */
export type ReminderOffset =
  | {
    readonly kind: 'minutes'
    readonly minutes: ReminderMinutes
  }
  | {
    readonly kind: 'days'
    readonly days: ReminderDays
    readonly time: LocalTime
  }

const localMoment = (
  day: LocalDate,
  time: LocalTime
): number => {
  const [y, m, d] = day.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm).getTime()
}

/**
 * Local epoch ms when `offset` is due for a Task on
 * `day` at `time` (or `DEFAULT_REMINDER_TIME` if null).
 */
export const reminderDueAt = (
  day: LocalDate,
  time: LocalTime | null,
  offset: ReminderOffset
): number => offset.kind === 'minutes'
  ? localMoment(day, time ?? DEFAULT_REMINDER_TIME)
    - offset.minutes * 60_000
  : localMoment(shiftDay(day, -offset.days), offset.time)
