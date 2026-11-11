import type { LocalDate } from './storage'

const pad = (n: number): string =>
  String(n).padStart(2, '0')

/** `date`'s local calendar date, as `YYYY-MM-DD`. */
export const localDate = (date: Date): LocalDate =>
  [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-')
