// The Reminders Widget's pure logic: the window it
// shows and each entry's label and text.
import { localDate } from '@shared/dates'
import type { DueReminder } from '@shared/reminders'
import { formatDate } from '@/locale/format'

/** Reminders due in this many days after `now`. */
export const REMINDERS_WINDOW_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

/** Epoch-ms span: now to 7 days later, both included. */
export const reminderWindow = (
  now: Date
): { from: number; to: number } => ({
  from: now.getTime(),
  to: now.getTime() + REMINDERS_WINDOW_DAYS * DAY_MS
})

const pad = (n: number): string => String(n).padStart(2, '0')

/** A time of day on a 24-hour clock: "09:30". */
const clock = (date: Date): string =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`

/** "Today 09:30", "Tomorrow 11:00" or "Thu 18:00". */
export const reminderLabel = (
  dueAt: number,
  now: Date
): string => {
  const due = new Date(dueAt)
  const today = localDate(now)
  const tomorrow = localDate(
    new Date(now.getFullYear(), now.getMonth(),
      now.getDate() + 1)
  )
  const day = localDate(due)
  if (day === today) return `Today ${clock(due)}`
  if (day === tomorrow) return `Tomorrow ${clock(due)}`
  return `${formatDate(due, 'weekday')} ${clock(due)}`
}

/**
 * "Dentist in 30 min", "Dentist now" or "Dentist (2 days before)".
 */
export const reminderText = (
  reminder: DueReminder
): string => {
  if (reminder.kind !== 'task') return ''
  const title = reminder.task.title
  const offset = reminder.offset
  if (offset.kind === 'days') {
    const plural = offset.days === 1 ? '' : 's'
    return `${title} (${offset.days} day${plural} before)`
  }
  if (offset.minutes === 0) return `${title} now`
  return `${title} in ${offset.minutes} min`
}
