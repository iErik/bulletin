import { z } from 'zod'
import { StorageFailure } from './errors'

const pad = (n: number): string =>
  String(n).padStart(2, '0')

/** `date`'s local calendar date, as `YYYY-MM-DD`. */
export const localDate = (date: Date): string =>
  [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-')

/** A real calendar date written as `YYYY-MM-DD`. */
export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => {
    const [y, m, d] = value.split('-').map(Number)
    const date = new Date(y!, m! - 1, d!)
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
