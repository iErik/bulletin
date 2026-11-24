import { asc, eq } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { localDate } from '@shared/dates'
import {
  compareForDay,
  scheduledDays,
  type NewRecurringTask,
  type Occurrence,
  type RecurringTask,
  type TaskSchedule,
  type Weekday
} from '@shared/recurring-tasks'
import type { DateRange } from '@shared/storage'
import type { Database } from './database'
import { dateRangeSchema, localDateSchema } from './dates'
import { parse, StorageFailure } from './errors'
import { recurringTasks } from './schema'

const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]
const localTimeSchema = z.string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const idSchema = createSelectSchema(recurringTasks, {
  id: schema => schema.positive()
}).shape.id
const weekdaySchema = z.number().int().min(0).max(6) as
  z.ZodType<Weekday>

/** Longest length a month can have (Feb allows 29). */
const maxDaysInMonth = (month: number): number =>
  new Date(Date.UTC(2024, month, 0)).getUTCDate()

const scheduleSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('days'),
    every: z.number().int().min(1)
  }),
  z.strictObject({
    kind: z.literal('weekly'),
    weekdays: z.array(weekdaySchema).min(1).refine(
      days => new Set(days).size === days.length,
      'Duplicate weekday'
    )
  }),
  z.strictObject({
    kind: z.literal('monthly'),
    day: z.number().int().min(1).max(31)
  }),
  z.strictObject({
    kind: z.literal('yearly'),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31)
  }).refine(
    ({ month, day }) => day <= maxDaysInMonth(month),
    { path: ['day'], message: 'Not a day of that month' }
  )
])

const newRecurringTaskSchema = z.strictObject({
  title: z.string().trim().min(1),
  time: localTimeSchema.nullable(),
  schedule: scheduleSchema,
  firstDay: localDateSchema
})

const encodeWeekdays = (days: readonly Weekday[]): number =>
  days.reduce<number>((m, d) => m | (1 << d), 0)

const decodeWeekdays = (mask: number): Weekday[] =>
  WEEKDAYS.filter(d => (mask & (1 << d)) !== 0)

type Row = typeof recurringTasks.$inferSelect
type ScheduleCols = Pick<
  typeof recurringTasks.$inferInsert,
  'kind' | 'every' | 'weekdays' | 'month' | 'monthDay'
>

const emptyCols = {
  every: null, weekdays: null, month: null, monthDay: null
}

const toColumns = (s: TaskSchedule): ScheduleCols => {
  switch (s.kind) {
    case 'days': return { ...emptyCols, kind: s.kind, every: s.every }
    case 'weekly': return {
      ...emptyCols, kind: s.kind, weekdays: encodeWeekdays(s.weekdays)
    }
    case 'monthly': return {
      ...emptyCols, kind: s.kind, monthDay: s.day
    }
    case 'yearly': return {
      ...emptyCols, kind: s.kind, month: s.month, monthDay: s.day
    }
  }
}

const toSchedule = (row: Row): TaskSchedule => {
  switch (row.kind) {
    case 'days': return { kind: 'days', every: row.every! }
    case 'weekly': return {
      kind: 'weekly', weekdays: decodeWeekdays(row.weekdays!)
    }
    case 'monthly': return { kind: 'monthly', day: row.monthDay! }
    case 'yearly': return {
      kind: 'yearly', month: row.month!, day: row.monthDay!
    }
    default:
      throw new Error(`Unknown schedule kind: ${row.kind}`)
  }
}

const toRecurringTask = (row: Row): RecurringTask => ({
  id: row.id,
  title: row.title,
  time: row.time,
  schedule: toSchedule(row),
  firstDay: row.firstDay,
  lastDay: row.lastDay,
  created: row.created
})

/** Every Recurring Task, stopped ones included. */
export const listRecurringTasks = async (
  db: Database
): Promise<RecurringTask[]> => {
  const rows = await db
    .select()
    .from(recurringTasks)
    .orderBy(asc(recurringTasks.created), asc(recurringTasks.id))
  return rows.map(toRecurringTask)
}

/** Creates a Recurring Task; `created` is now. */
export const createRecurringTask = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<RecurringTask> => {
  const { title, time, schedule, firstDay }: NewRecurringTask =
    parse(newRecurringTaskSchema, value)
  const [row] = await db.insert(recurringTasks).values({
    title, time, ...toColumns(schedule),
    firstDay, lastDay: null, created: now.getTime()
  }).returning()
  return toRecurringTask(row)
}

/**
 * Sets `lastDay` to today, keeping today's Occurrence.
 * Already-stopped rules keep their original `lastDay`.
 */
export const stopRecurringTask = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<RecurringTask> => {
  const id = parse(idSchema, value)
  const today = localDate(now)
  return db.transaction(tx => {
    const existing = tx.select().from(recurringTasks)
      .where(eq(recurringTasks.id, id)).get()
    if (!existing)
      throw new StorageFailure({ code: 'not-found' })
    if (existing.lastDay !== null)
      return toRecurringTask(existing)

    const row = tx.update(recurringTasks)
      .set({ lastDay: today })
      .where(eq(recurringTasks.id, id))
      .returning().get()!
    return toRecurringTask(row)
  })
}

/** Deletes a Recurring Task by its id. */
export const deleteRecurringTask = async (
  db: Database,
  value: unknown
): Promise<null> => {
  const id = parse(idSchema, value)
  const deleted = await db.delete(recurringTasks)
    .where(eq(recurringTasks.id, id)).returning()
  if (deleted.length === 0)
    throw new StorageFailure({ code: 'not-found' })
  return null
}

/** Expands every rule over the span, in day order. */
export const listOccurrences = async (
  db: Database,
  value: unknown
): Promise<Occurrence[]> => {
  const range: DateRange = parse(dateRangeSchema, value)
  const rows = await db.select().from(recurringTasks)
    .orderBy(asc(recurringTasks.id))
  const occurrences = rows.flatMap(row => {
    const r = toRecurringTask(row)
    return scheduledDays(r, range).map(scheduled => ({
      ruleId: r.id, scheduled, title: r.title, day: scheduled,
      time: r.time, doneAt: null, moves: 0, created: r.created
    }))
  })
  return occurrences.sort((a, b) =>
    compareForDay(a, b) || a.ruleId - b.ruleId)
}
