import type { DateRange, LocalDate } from './storage'

const pad = (n: number): string =>
  String(n).padStart(2, '0')

/** `date`'s local calendar date, as `YYYY-MM-DD`. */
export const localDate = (date: Date): LocalDate =>
  [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-')

/** Moves `date` by `delta` calendar days, DST-safe. */
export const shiftDay = (
  date: LocalDate,
  delta: number
): LocalDate => {
  const [y, m, d] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + delta))
  return [
    shifted.getUTCFullYear(),
    pad(shifted.getUTCMonth() + 1),
    pad(shifted.getUTCDate())
  ].join('-')
}

/**
 * The previous month from its 1st to `date`'s day of
 * the month, capped at that month's last day (for
 * example, Mar 31 -> Feb 1-28).
 */
export const sameSpanLastMonth = (
  date: LocalDate
): DateRange => {
  const [year, month, day] = date.split('-').map(Number)
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const lastDay = new Date(
    Date.UTC(prevYear, prevMonth, 0)
  ).getUTCDate()
  const prefix = `${prevYear}-${pad(prevMonth)}`
  return {
    from: `${prefix}-01`,
    to: `${prefix}-${pad(Math.min(day, lastDay))}`
  }
}
