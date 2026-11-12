import { and, asc, eq, gt, gte, lt, ne } from 'drizzle-orm'
import {
  createInsertSchema,
  createSelectSchema
} from 'drizzle-orm/zod'
import type { DateRange } from '@shared/storage'
import type {
  NewSleepPeriod,
  SleepPeriod
} from '@shared/sleep'
import type { Database } from './database'
import { dateRangeSchema, dayWindow } from './dates'
import { parse, StorageFailure } from './errors'
import { MAX_PERIOD_MS, sleep } from './schema'

const newPeriodSchema = createInsertSchema(sleep, {
  start: schema => schema.nonnegative(),
  end: schema => schema.nonnegative()
}).omit({ id: true }).strict()

const periodSchema = createSelectSchema(sleep, {
  id: schema => schema.positive(),
  start: schema => schema.nonnegative(),
  end: schema => schema.nonnegative()
}).strict()

const idSchema = periodSchema.shape.id

// Rows and the shared type must stay in step.
const toPeriod = (
  row: typeof sleep.$inferSelect
): SleepPeriod => row

/**
 * Throws unless the Period ends after it starts, lasts
 * at most 24 hours and doesn't end after `now`.
 */
const assertPeriodRules = (
  { start, end }: NewSleepPeriod,
  now: Date
): void => {
  if (end <= start)
    throw new StorageFailure({ code: 'reversed-period' })
  if (end - start > MAX_PERIOD_MS)
    throw new StorageFailure({ code: 'period-too-long' })
  if (end > now.getTime())
    throw new StorageFailure({ code: 'future-date' })
}

/**
 * Throws if the Period overlaps any other than the
 * one with id `self`. Periods may touch end to start.
 */
const assertNoOverlap = (
  tx: Pick<Database, 'select'>,
  { start, end }: NewSleepPeriod,
  self?: number
): void => {
  const clash = tx
    .select({ id: sleep.id })
    .from(sleep)
    .where(and(
      lt(sleep.start, end),
      gt(sleep.end, start),
      self === undefined ? undefined : ne(sleep.id, self)
    ))
    .get()
  if (clash) {
    throw new StorageFailure({
      code: 'overlapping-period'
    })
  }
}

/**
 * Periods whose Head falls in the range's calendar
 * days, local time, oldest first.
 */
export const listSleep = async (
  db: Database,
  range: unknown
): Promise<SleepPeriod[]> => {
  const days: DateRange = parse(dateRangeSchema, range)
  const { start, end } = dayWindow(days)
  const rows = await db
    .select()
    .from(sleep)
    .where(and(
      gte(sleep.start, start),
      lt(sleep.start, end)
    ))
    .orderBy(asc(sleep.start))
  return rows.map(toPeriod)
}

/** Saves a new Period. */
export const createSleep = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<SleepPeriod> => {
  const period = parse(newPeriodSchema, value)
  assertPeriodRules(period, now)
  return db.transaction(tx => {
    assertNoOverlap(tx, period)
    const row = tx
      .insert(sleep)
      .values(period)
      .returning()
      .get()
    return toPeriod(row)
  })
}

/** Moves an existing Period's Head and Tail. */
export const updateSleep = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<SleepPeriod> => {
  const { id, ...period } = parse(periodSchema, value)
  assertPeriodRules(period, now)
  return db.transaction(tx => {
    assertNoOverlap(tx, period, id)
    const row = tx
      .update(sleep)
      .set(period)
      .where(eq(sleep.id, id))
      .returning()
      .get()
    if (!row)
      throw new StorageFailure({ code: 'not-found' })
    return toPeriod(row)
  })
}

/** Deletes a Period by its id. */
export const deleteSleep = async (
  db: Database,
  value: unknown
): Promise<null> => {
  const id = parse(idSchema, value)
  const deleted = await db
    .delete(sleep)
    .where(eq(sleep.id, id))
    .returning()
  if (deleted.length === 0)
    throw new StorageFailure({ code: 'not-found' })
  return null
}
