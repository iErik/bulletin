import { z } from 'zod'
import type {
  ReminderDays,
  ReminderMinutes,
  ReminderOffset
} from '@shared/reminders'
import { localTimeSchema } from './dates'

/** Validates a Reminder offset payload. */
export const reminderOffsetSchema = z.discriminatedUnion(
  'kind',
  [
    z.strictObject({
      kind: z.literal('minutes'),
      minutes: z.union([
        z.literal(0), z.literal(15),
        z.literal(30), z.literal(60)
      ])
    }),
    z.strictObject({
      kind: z.literal('days'),
      days: z.union([z.literal(1), z.literal(2)]),
      time: localTimeSchema
    })
  ]
)

/** SQLite columns storing one optional Reminder offset. */
export interface ReminderCols {
  readonly reminderMinutes: number | null
  readonly reminderDays: number | null
  readonly reminderTime: string | null
}

const noReminder: ReminderCols = {
  reminderMinutes: null,
  reminderDays: null,
  reminderTime: null
}

/** Encodes a `ReminderOffset | null` into table columns. */
export const toReminderCols = (
  reminder: ReminderOffset | null
): ReminderCols => {
  if (reminder === null) return noReminder
  if (reminder.kind === 'minutes')
    return { ...noReminder, reminderMinutes: reminder.minutes }
  return {
    reminderMinutes: null,
    reminderDays: reminder.days,
    reminderTime: reminder.time
  }
}

/** Decodes Reminder columns back to `ReminderOffset`. */
export const fromReminderCols = (
  row: ReminderCols
): ReminderOffset | null => {
  if (row.reminderMinutes !== null) {
    return {
      kind: 'minutes',
      minutes: row.reminderMinutes as ReminderMinutes
    }
  }
  if (row.reminderDays !== null && row.reminderTime !== null) {
    return {
      kind: 'days',
      days: row.reminderDays as ReminderDays,
      time: row.reminderTime
    }
  }
  return null
}

/** Whether two rows store the exact same Reminder. */
export const sameReminderCols = (
  a: ReminderCols,
  b: ReminderCols
): boolean =>
  a.reminderMinutes === b.reminderMinutes
  && a.reminderDays === b.reminderDays
  && a.reminderTime === b.reminderTime
