/**
 * The Task editor's day and time, free of rendering:
 * which choice a planned day matches, the day a quick
 * choice plans, and times typed on either clock.
 * Today is the real date, never the Selected Date.
 */
import { addDays } from 'date-fns'
import { localDate } from '@shared/dates'
import type { LocalDate } from '@shared/storage'
import type { LocalTime } from '@shared/tasks'
import { formatTime } from '@/locale/format'
import { parseClock } from '@/sleep/clock'

/** How a Task's day is chosen. */
export type DayChoice =
  | 'today'
  | 'tomorrow'
  | 'someday'
  | 'date'

/** A choice that stands for one day, or Someday. */
export type QuickChoice = Exclude<DayChoice, 'date'>

/** Which choice `day` matches, from `today`. */
export const choiceOf = (
  day: LocalDate | null,
  today: Date
): DayChoice => {
  if (day === null) return 'someday'
  if (day === localDate(today)) return 'today'
  if (day === localDate(addDays(today, 1)))
    return 'tomorrow'
  return 'date'
}

/** The day `choice` plans, from `today`. */
export const dayOf = (
  choice: QuickChoice,
  today: Date
): LocalDate | null => {
  if (choice === 'someday') return null
  const ahead = choice === 'tomorrow' ? 1 : 0
  return localDate(addDays(today, ahead))
}

/** `day` at local midnight. */
export const dateOf = (day: LocalDate): Date => {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}

const pad = (n: number): string =>
  String(n).padStart(2, '0')

/**
 * A typed time as `HH:MM`: "14:20", "2:20 pm" or
 * "9". Blank is `null`, any time; `undefined` when
 * it isn't a time.
 */
export const parseTime = (
  text: string
): LocalTime | null | undefined => {
  if (!text.trim()) return null
  const clock = parseClock(text)
  if (!clock) return undefined
  return `${pad(clock.hours)}:${pad(clock.minutes)}`
}

/** `time` on the Locale's clock; blank for any time. */
export const timeText = (time: LocalTime | null): string => {
  if (time === null) return ''
  const [hours, minutes] = time.split(':').map(Number)
  return formatTime(new Date(2000, 0, 1, hours, minutes))
}
