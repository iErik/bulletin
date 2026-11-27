// The Reminders Widget's pure logic: the window it
// shows and each entry's label. The text is shared:
// `formatReminderText` in @shared/reminders.
import { localDate, shiftDay } from '@shared/dates'
import { formatDate, formatTime } from '@/locale/format'

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

/** "Today 9:30 AM", "Tomorrow 11:00 AM" or "Thu 6:00 PM". */
export const reminderLabel = (
  dueAt: number,
  now: Date
): string => {
  const due = new Date(dueAt)
  const today = localDate(now)
  const tomorrow = shiftDay(today, 1)
  const day = localDate(due)
  if (day === today) return `Today ${formatTime(due)}`
  if (day === tomorrow) return `Tomorrow ${formatTime(due)}`
  return `${formatDate(due, 'weekday')} ${formatTime(due)}`
}
