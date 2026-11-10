import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { createInsertSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { MOODS, type MoodEntry } from '@shared/mood'
import type { DateRange } from '@shared/storage'
import type { Database } from './database'
import {
  assertNotFuture,
  dateRangeSchema,
  localDateSchema
} from './dates'
import { parse, StorageFailure } from './errors'
import { mood } from './schema'

const entrySchema = createInsertSchema(mood, {
  date: localDateSchema,
  mood: z.enum(MOODS.map(({ key }) => key))
}).strict()

/** Validates an Entry and rejects future dates. */
const parseEntry = (
  value: unknown,
  now: Date
): MoodEntry => {
  const entry = parse(entrySchema, value)
  assertNotFuture(entry.date, now)
  return entry
}

/**
 * The Entry a row holds. Main writes only known keys,
 * so the cast holds.
 */
const toEntry = (
  row: typeof mood.$inferSelect
): MoodEntry => row as MoodEntry

/** Entries from the range's days, oldest first. */
export const listMood = async (
  db: Database,
  range: unknown
): Promise<MoodEntry[]> => {
  const { from, to }: DateRange =
    parse(dateRangeSchema, range)
  const rows = await db
    .select()
    .from(mood)
    .where(and(gte(mood.date, from), lte(mood.date, to)))
    .orderBy(asc(mood.date))
  return rows.map(toEntry)
}

/** Sets a day's Mood, replacing its Entry if any. */
export const createMood = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<MoodEntry> => {
  const entry = parseEntry(value, now)
  const [row] = await db
    .insert(mood)
    .values(entry)
    .onConflictDoUpdate({
      target: mood.date,
      set: { mood: entry.mood }
    })
    .returning()
  return toEntry(row)
}

/** Changes the Mood of an existing day's Entry. */
export const updateMood = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<MoodEntry> => {
  const entry = parseEntry(value, now)
  const [row] = await db
    .update(mood)
    .set({ mood: entry.mood })
    .where(eq(mood.date, entry.date))
    .returning()
  if (!row) throw new StorageFailure({ code: 'not-found' })
  return toEntry(row)
}

/** Clears a day's Mood by deleting its Entry. */
export const deleteMood = async (
  db: Database,
  value: unknown
): Promise<null> => {
  const date = parse(localDateSchema, value)
  const deleted = await db
    .delete(mood)
    .where(eq(mood.date, date))
    .returning()
  if (deleted.length === 0)
    throw new StorageFailure({ code: 'not-found' })
  return null
}
