import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { createInsertSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import {
  SLEEP_QUALITY_STEPS,
  type SleepQualityEntry
} from '@shared/sleep-quality'
import type { DateRange } from '@shared/storage'
import type { Database } from './database'
import {
  assertNotFuture,
  dateRangeSchema,
  localDateSchema
} from './dates'
import { parse, StorageFailure } from './errors'
import { sleepQuality } from './schema'

const ratingSchema = z.union([
  z.literal(SLEEP_QUALITY_STEPS[0].value),
  z.literal(SLEEP_QUALITY_STEPS[1].value),
  z.literal(SLEEP_QUALITY_STEPS[2].value),
  z.literal(SLEEP_QUALITY_STEPS[3].value),
  z.literal(SLEEP_QUALITY_STEPS[4].value)
])

const entrySchema = createInsertSchema(sleepQuality, {
  date: localDateSchema,
  rating: ratingSchema
}).strict()

/** Validates an Entry and rejects future dates. */
const parseEntry = (
  value: unknown,
  now: Date
): SleepQualityEntry => {
  const entry = parse(entrySchema, value)
  assertNotFuture(entry.date, now)
  return entry
}

/**
 * The Entry a row holds. Main writes only known keys,
 * so the cast holds.
 */
const toEntry = (
  row: typeof sleepQuality.$inferSelect
): SleepQualityEntry => row as SleepQualityEntry

/** Entries from the range's days, oldest first. */
export const listSleepQuality = async (
  db: Database,
  range: unknown
): Promise<SleepQualityEntry[]> => {
  const { from, to }: DateRange =
    parse(dateRangeSchema, range)
  const rows = await db
    .select()
    .from(sleepQuality)
    .where(and(
      gte(sleepQuality.date, from),
      lte(sleepQuality.date, to)
    ))
    .orderBy(asc(sleepQuality.date))
  return rows.map(toEntry)
}

/** Sets a day's rating, replacing its Entry if any. */
export const createSleepQuality = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<SleepQualityEntry> => {
  const entry = parseEntry(value, now)
  const [row] = await db
    .insert(sleepQuality)
    .values(entry)
    .onConflictDoUpdate({
      target: sleepQuality.date,
      set: { rating: entry.rating }
    })
    .returning()
  return toEntry(row)
}

/** Clears a day's rating by deleting its Entry. */
export const deleteSleepQuality = async (
  db: Database,
  value: unknown
): Promise<null> => {
  const date = parse(localDateSchema, value)
  const deleted = await db
    .delete(sleepQuality)
    .where(eq(sleepQuality.date, date))
    .returning()
  if (deleted.length === 0)
    throw new StorageFailure({ code: 'not-found' })
  return null
}
