import { and, asc, eq, gte, lte, or } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { localDate } from '@shared/dates'
import {
  compareForDay,
  occursOn,
  scheduledDays,
  type NewRecurringTask,
  type Occurrence,
  type OccurrenceDone,
  type OccurrenceKey,
  type OccurrenceUpdate,
  type RecurringTask,
  type TaskSchedule,
  type Weekday
} from '@shared/recurring-tasks'
import type { DateRange, LocalDate } from '@shared/storage'
import { moveIncrement } from '@shared/tasks'
import type { Database } from './database'
import { dateRangeSchema, localDateSchema } from './dates'
import { parse, StorageFailure } from './errors'
import { occurrences, recurringTasks } from './schema'

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

const occurrenceKeySchema = z.strictObject({
  ruleId: idSchema,
  scheduled: localDateSchema
})

const occurrenceUpdateSchema = z.strictObject({
  ruleId: idSchema,
  scheduled: localDateSchema,
  title: z.string().trim().min(1).optional(),
  day: localDateSchema.optional(),
  time: localTimeSchema.nullable().optional()
}).refine(
  ({ title, day, time }) => title !== undefined
    || day !== undefined
    || time !== undefined,
  'Nothing to change'
)

const occurrenceDoneSchema = z.strictObject({
  ruleId: idSchema,
  scheduled: localDateSchema,
  done: z.boolean()
})

type Reader = Pick<Database, 'select'>
type OccurrenceRow = typeof occurrences.$inferSelect

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

const resolveOccurrence = (
  rule: RecurringTask,
  scheduled: LocalDate,
  row?: OccurrenceRow
): Occurrence => ({
  ruleId: rule.id,
  scheduled,
  title: row?.title ?? rule.title,
  day: row?.day ?? scheduled,
  time: row?.timeChanged ? row.time : rule.time,
  doneAt: row?.doneAt ?? null,
  moves: row?.moves ?? 0,
  created: rule.created
})

const requireOccurrence = (
  tx: Reader,
  { ruleId, scheduled }: OccurrenceKey
): { rule: RecurringTask; existing: OccurrenceRow | undefined } => {
  const ruleRow = tx.select().from(recurringTasks)
    .where(eq(recurringTasks.id, ruleId)).get()
  if (!ruleRow)
    throw new StorageFailure({ code: 'not-found' })
  const rule = toRecurringTask(ruleRow)
  if (!occursOn(rule, scheduled))
    throw new StorageFailure({ code: 'not-found' })
  const existing = tx.select().from(occurrences)
    .where(and(
      eq(occurrences.ruleId, ruleId),
      eq(occurrences.scheduled, scheduled)
    )).get()
  if (existing?.skipped)
    throw new StorageFailure({ code: 'not-found' })
  return { rule, existing }
}

const occKey = (ruleId: number, scheduled: LocalDate): string =>
  `${ruleId}:${scheduled}`

/** Expands every rule over the span, in day order. */
export const listOccurrences = async (
  db: Database,
  value: unknown
): Promise<Occurrence[]> => {
  const range: DateRange = parse(dateRangeSchema, value)
  return db.transaction(tx => {
    const rules = tx.select().from(recurringTasks)
      .orderBy(asc(recurringTasks.id)).all()
      .map(toRecurringTask)
    const rulesById = new Map(rules.map(r => [r.id, r]))
    const rows = tx.select().from(occurrences).where(or(
      and(
        gte(occurrences.scheduled, range.from),
        lte(occurrences.scheduled, range.to)
      ),
      and(
        gte(occurrences.day, range.from),
        lte(occurrences.day, range.to)
      )
    )).all()

    const byKey = new Map(
      rows.map(r => [occKey(r.ruleId, r.scheduled), r])
    )
    const seen = new Set<string>()
    const result: Occurrence[] = []
    const add = (
      rule: RecurringTask,
      scheduled: LocalDate,
      row?: OccurrenceRow
    ): void => {
      const key = occKey(rule.id, scheduled)
      if (seen.has(key) || row?.skipped) return
      seen.add(key)
      const item = resolveOccurrence(rule, scheduled, row)
      if (item.day >= range.from && item.day <= range.to)
        result.push(item)
    }

    for (const rule of rules) {
      for (const scheduled of scheduledDays(rule, range))
        add(rule, scheduled, byKey.get(occKey(rule.id, scheduled)))
    }
    for (const row of rows) {
      const rule = rulesById.get(row.ruleId)
      if (rule && occursOn(rule, row.scheduled))
        add(rule, row.scheduled, row)
    }
    return result.sort((a, b) =>
      compareForDay(a, b)
      || a.ruleId - b.ruleId
      || a.scheduled.localeCompare(b.scheduled))
  })
}

/** Changes one Occurrence; a later day raises `moves`. */
export const updateOccurrence = async (
  db: Database,
  value: unknown
): Promise<Occurrence> => {
  const changes: OccurrenceUpdate =
    parse(occurrenceUpdateSchema, value)
  const { ruleId, scheduled, title, day, time } = changes
  return db.transaction(tx => {
    const { rule, existing } =
      requireOccurrence(tx, { ruleId, scheduled })
    const currentDay = existing?.day ?? scheduled
    const nextDay = day !== undefined
      ? (day === scheduled ? null : day)
      : (existing?.day ?? null)
    const moves = (existing?.moves ?? 0)
      + (day !== undefined ? moveIncrement(currentDay, day) : 0)
    const nextTitle = title ?? existing?.title ?? null
    const nextTimeChanged = time !== undefined
      ? 1
      : (existing?.timeChanged ?? 0)
    const nextTime = time !== undefined
      ? time
      : (existing?.time ?? null)

    const row = tx.insert(occurrences).values({
      ruleId,
      scheduled,
      title: nextTitle,
      time: nextTime,
      timeChanged: nextTimeChanged,
      day: nextDay,
      doneAt: existing?.doneAt ?? null,
      moves,
      skipped: 0
    }).onConflictDoUpdate({
      target: [occurrences.ruleId, occurrences.scheduled],
      set: {
        title: nextTitle,
        time: nextTime,
        timeChanged: nextTimeChanged,
        day: nextDay,
        moves
      }
    }).returning().get()
    return resolveOccurrence(rule, scheduled, row)
  })
}

/** Sets or clears `doneAt`; redone keeps the first. */
export const setOccurrenceDone = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<Occurrence> => {
  const { ruleId, scheduled, done }: OccurrenceDone =
    parse(occurrenceDoneSchema, value)
  return db.transaction(tx => {
    const { rule, existing } =
      requireOccurrence(tx, { ruleId, scheduled })
    let doneAt = existing?.doneAt ?? null
    if (!done) doneAt = null
    else if (doneAt === null) doneAt = now.getTime()

    const row = tx.insert(occurrences).values({
      ruleId,
      scheduled,
      doneAt
    }).onConflictDoUpdate({
      target: [occurrences.ruleId, occurrences.scheduled],
      set: { doneAt }
    }).returning().get()
    return resolveOccurrence(rule, scheduled, row)
  })
}

/** Drops one Occurrence without changing the rule. */
export const skipOccurrence = async (
  db: Database,
  value: unknown
): Promise<null> => {
  const { ruleId, scheduled }: OccurrenceKey =
    parse(occurrenceKeySchema, value)
  return db.transaction(tx => {
    requireOccurrence(tx, { ruleId, scheduled })
    tx.insert(occurrences).values({
      ruleId,
      scheduled,
      skipped: 1
    }).onConflictDoUpdate({
      target: [occurrences.ruleId, occurrences.scheduled],
      set: { skipped: 1 }
    }).run()
    return null
  })
}
