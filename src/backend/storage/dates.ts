import { z } from 'zod'
import { localDate } from '@shared/dates'
import type { DateRange } from '@shared/storage'
import { StorageFailure } from './errors'

/** A real calendar date written as `YYYY-MM-DD`. */
export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => {
    const [y, m, d] = value.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return localDate(date) === value
  }, 'Not a calendar date')

/** A range of days whose start isn't after its end. */
export const dateRangeSchema = z
  .strictObject({
    from: localDateSchema,
    to: localDateSchema
  })
  .refine(({ from, to }) => from <= to, {
    path: ['to'],
    message: 'Range ends before it starts'
  })

/**
 * Rejects Entries dated after today, local time.
 */
export const assertNotFuture = (
  date: string,
  now: Date
): void => {
  if (date > localDate(now))
    throw new StorageFailure({ code: 'future-date' })
}

/** Noon, local time, `days` after `date`. */
const noonAfter = (date: string, days = 0): number => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d + days, 12).getTime()
}

/**
 * The epoch-ms window covered by a range of days, each
 * running from noon to noon the next day (local time):
 * from noon on `from`, up to but excluding noon on the
 * day after `to`.
 */
export const noonWindow = (
  { from, to }: DateRange
): { start: number; end: number } => ({
  start: noonAfter(from),
  end: noonAfter(to, 1)
})
