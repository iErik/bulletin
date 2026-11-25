import { shiftDay } from './dates'
import type { Occurrence } from './recurring-tasks'
import type { LocalDate, StorageResult } from './storage'
import type { LocalTime, Task } from './tasks'

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

/** Identifies one Task or Occurrence Reminder. */
export type ReminderTarget =
  | { readonly kind: 'task'; readonly id: number }
  | {
    readonly kind: 'occurrence'
    readonly ruleId: number
    readonly scheduled: LocalDate
  }

/** A Reminder due in a queried span, with its Task. */
export type DueReminder =
  | {
    readonly kind: 'task'
    readonly task: Task
    readonly offset: ReminderOffset
    readonly dueAt: number
    readonly notifiedAt: number | null
  }
  | {
    readonly kind: 'occurrence'
    readonly occurrence: Occurrence
    readonly offset: ReminderOffset
    readonly dueAt: number
    readonly notifiedAt: number | null
  }

/** Epoch-ms span (`from`..`to`, both included). */
export interface DueReminderQuery {
  readonly from: number
  readonly to: number
  readonly onlyUnnotified?: boolean
}

/** `window.bulletin.reminders`. */
export interface RemindersApi {
  /** Undone Reminders due in the span, soonest first. */
  listDue(
    query: DueReminderQuery
  ): Promise<StorageResult<DueReminder[]>>
  /** Records a Reminder as notified; idempotent. */
  markNotified(
    target: ReminderTarget
  ): Promise<StorageResult<number>>
}

/** IPC channel per `RemindersApi` method. */
export const REMINDERS_CHANNELS = {
  listDue: 'reminders:list-due',
  markNotified: 'reminders:mark-notified'
} as const satisfies Record<keyof RemindersApi, string>
