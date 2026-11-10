import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { createInsertSchema } from 'drizzle-orm/zod'
import type { DateRange } from '@shared/storage'
import type { WeightEntry } from '@shared/weight'
import type { Database } from './database'
import {
  assertNotFuture,
  dateRangeSchema,
  localDateSchema
} from './dates'
import { parse, StorageFailure } from './errors'
import { weight } from './schema'

/** Heavier than anyone has weighed: 1000 kg. */
const MAX_GRAMS = 1_000_000

const entrySchema = createInsertSchema(weight, {
  date: localDateSchema,
  grams: schema => schema.positive().max(MAX_GRAMS)
}).strict()

// Rows and the shared type must stay in step.
const toEntry = (
  row: typeof weight.$inferSelect
): WeightEntry => row

/** Validates an Entry and rejects future dates. */
const parseEntry = (
  value: unknown,
  now: Date
): WeightEntry => {
  const entry = parse(entrySchema, value)
  assertNotFuture(entry.date, now)
  return entry
}

/** Entries from the range's days, oldest first. */
export const listWeight = async (
  db: Database,
  range: unknown
): Promise<WeightEntry[]> => {
  const { from, to }: DateRange =
    parse(dateRangeSchema, range)
  const rows = await db
    .select()
    .from(weight)
    .where(and(
      gte(weight.date, from),
      lte(weight.date, to)
    ))
    .orderBy(asc(weight.date))
  return rows.map(toEntry)
}

/** Saves an Entry, replacing that day's if any. */
export const createWeight = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<WeightEntry> => {
  const entry = parseEntry(value, now)
  const [row] = await db
    .insert(weight)
    .values(entry)
    .onConflictDoUpdate({
      target: weight.date,
      set: { grams: entry.grams }
    })
    .returning()
  return toEntry(row)
}

/** Changes the grams of an existing day's Entry. */
export const updateWeight = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<WeightEntry> => {
  const entry = parseEntry(value, now)
  const [row] = await db
    .update(weight)
    .set({ grams: entry.grams })
    .where(eq(weight.date, entry.date))
    .returning()
  if (!row) throw new StorageFailure({ code: 'not-found' })
  return toEntry(row)
}

/** Deletes a day's Entry. */
export const deleteWeight = async (
  db: Database,
  value: unknown
): Promise<null> => {
  const date = parse(localDateSchema, value)
  const deleted = await db
    .delete(weight)
    .where(eq(weight.date, date))
    .returning()
  if (deleted.length === 0)
    throw new StorageFailure({ code: 'not-found' })
  return null
}
