/**
 * The layout of a Month Grid (see `CONTEXT.md`): one
 * month's days in weeks, as rows of seven slots.
 */
import {
  addDays,
  getDaysInMonth,
  startOfMonth
} from 'date-fns'

/** A day at local midnight, or an empty slot. */
export type Slot = Date | null

/**
 * The weeks of `month`'s month, each seven slots long
 * and starting on `weekStartsOn` (0 is Sunday, 1
 * Monday). Slots before the 1st and after the last day
 * are empty; there are 4 to 6 weeks.
 */
export const monthWeeks = (
  month: Date,
  weekStartsOn: number
): Slot[][] => {
  const first = startOfMonth(month)
  const blanks = (first.getDay() - weekStartsOn + 7) % 7
  const length = getDaysInMonth(first)
  const count = Math.ceil((blanks + length) / 7) * 7

  const slots = Array.from({ length: count }, (_, i) => {
    const day = i - blanks
    return day >= 0 && day < length
      ? addDays(first, day)
      : null
  })
  return Array.from(
    { length: count / 7 },
    (_, week) => slots.slice(week * 7, week * 7 + 7)
  )
}

/**
 * Seven dates, one per weekday column, in the order of
 * `monthWeeks`' columns: for the weekday headers.
 */
export const weekdays = (weekStartsOn: number): Date[] =>
  // January 4th, 1970 was a Sunday.
  Array.from({ length: 7 }, (_, i) =>
    new Date(1970, 0, 4 + weekStartsOn + i))
