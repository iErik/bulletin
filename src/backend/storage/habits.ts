import {
  and,
  asc,
  eq,
  gte,
  isNull,
  lte
} from 'drizzle-orm'
import {
  createInsertSchema,
  createSelectSchema
} from 'drizzle-orm/zod'
import { z } from 'zod'
import {
  HABIT_ICONS,
  type ArchivePeriod,
  type Habit,
  type HabitEntry,
  type HabitIcon,
  type HabitStatus
} from '@shared/habits'
import { localDate } from '@shared/dates'
import type { DateRange } from '@shared/storage'
import type { Database } from './database'
import {
  assertNotFuture,
  dateRangeSchema,
  localDateSchema
} from './dates'
import { parse, StorageFailure } from './errors'
import { habitArchivePeriods, habitEntries, habits }
  from './schema'

const newHabitSchema = createInsertSchema(habits, {
  name: z.string().trim().min(1),
  icon: z.enum(HABIT_ICONS)
}).pick({ name: true, icon: true }).strict()

const idSchema = createSelectSchema(habits, {
  id: schema => schema.positive()
}).shape.id

const changesSchema = newHabitSchema
  .partial()
  .extend({ id: idSchema })
  .refine(
    ({ name, icon }) => name !== undefined
      || icon !== undefined,
    'Nothing to change'
  )

const statusSchema = z.enum(['active', 'archived', 'all'])

const entrySchema = createInsertSchema(habitEntries, {
  habitId: schema => schema.positive(),
  date: localDateSchema
}).strict()

type Reader = Pick<Database, 'select'>

type Writer = Reader & Pick<
  Database,
  'insert' | 'update' | 'delete'
>

/** The calendar day before `day` (`YYYY-MM-DD`). */
const dayBefore = (day: string): string => {
  const [year, month, date] = day.split('-').map(Number)
  const prev = new Date(Date.UTC(year, month - 1, date - 1))
  const pad = (n: number): string =>
    String(n).padStart(2, '0')
  return [
    prev.getUTCFullYear(),
    pad(prev.getUTCMonth() + 1),
    pad(prev.getUTCDate())
  ].join('-')
}

/**
 * The Habit a row holds, with its periods. Main writes
 * only known icon keys, so the cast holds.
 */
const toHabit = (
  row: typeof habits.$inferSelect,
  periods: readonly ArchivePeriod[]
): Habit => ({
  id: row.id,
  name: row.name,
  icon: row.icon as HabitIcon,
  created: row.created,
  archived: periods.some(period => period.end === null),
  archivePeriods: periods
})

/** One Habit's Archive Periods, oldest first. */
const periodsFor = (
  tx: Reader,
  habitId: number
): ArchivePeriod[] =>
  tx
    .select({
      start: habitArchivePeriods.start,
      end: habitArchivePeriods.end
    })
    .from(habitArchivePeriods)
    .where(eq(habitArchivePeriods.habitId, habitId))
    .orderBy(asc(habitArchivePeriods.start))
    .all()

/** Every Habit's periods, oldest first within each. */
const allPeriods = (
  tx: Reader
): Map<number, ArchivePeriod[]> => {
  const rows = tx
    .select()
    .from(habitArchivePeriods)
    .orderBy(
      asc(habitArchivePeriods.habitId),
      asc(habitArchivePeriods.start)
    )
    .all()
  const map = new Map<number, ArchivePeriod[]>()
  for (const row of rows) {
    const periods = map.get(row.habitId) ?? []
    periods.push({ start: row.start, end: row.end })
    map.set(row.habitId, periods)
  }
  return map
}

/** The Habit with `id`, or none. */
const readHabit = (
  tx: Reader,
  id: number
): Habit | undefined => {
  const row = tx
    .select()
    .from(habits)
    .where(eq(habits.id, id))
    .get()
  return row && toHabit(row, periodsFor(tx, row.id))
}

/** The Habit with `id`, or `not-found`. */
const requireHabit = (tx: Reader, id: number): Habit => {
  const habit = readHabit(tx, id)
  if (!habit)
    throw new StorageFailure({ code: 'not-found' })
  return habit
}

/**
 * The Habit, other than the one with id `self`, whose
 * name matches `name` ignoring case, if any.
 */
const findByName = (
  tx: Reader,
  name: string,
  self?: number
): Habit | undefined => {
  const key = name.toLowerCase()
  const row = tx.select().from(habits).all().find(
    habit => habit.id !== self
      && habit.name.toLowerCase() === key
  )
  return row && toHabit(row, periodsFor(tx, row.id))
}

/** The `name-taken` failure, saying which Habit. */
const nameTaken = (habit: Habit): StorageFailure =>
  new StorageFailure({
    code: 'name-taken',
    habit: habit.archived ? 'archived' : 'active'
  })

/**
 * Ends the open period the day before `day`. A period
 * that would have no days is deleted instead.
 */
const closeOpenPeriod = (
  tx: Writer,
  habitId: number,
  day: string
): void => {
  const open = tx
    .select()
    .from(habitArchivePeriods)
    .where(and(
      eq(habitArchivePeriods.habitId, habitId),
      isNull(habitArchivePeriods.end)
    ))
    .get()
  if (!open) return
  const end = dayBefore(day)
  const where = and(
    eq(habitArchivePeriods.habitId, habitId),
    eq(habitArchivePeriods.start, open.start)
  )
  if (end < open.start) {
    tx.delete(habitArchivePeriods).where(where).run()
    return
  }
  tx
    .update(habitArchivePeriods)
    .set({ end })
    .where(where)
    .run()
}

/** True when `date` falls inside `period`, inclusive. */
const covers = (
  period: ArchivePeriod,
  date: string
): boolean =>
  date >= period.start
    && (period.end === null || date <= period.end)

/** Active, archived, or every Habit, oldest first. */
export const listHabits = async (
  db: Database,
  value: unknown
): Promise<Habit[]> => {
  const status: HabitStatus = parse(statusSchema, value)
  return db.transaction(tx => {
    const periods = allPeriods(tx)
    return tx
      .select()
      .from(habits)
      .orderBy(asc(habits.created), asc(habits.id))
      .all()
      .map(row => toHabit(
        row,
        periods.get(row.id) ?? []
      ))
      .filter(habit =>
        status === 'all'
        || habit.archived === (status === 'archived'))
  })
}

/**
 * Creates a Habit dated today. If an archived Habit has
 * the name, restores it with the given icon instead,
 * ending its open Archive Period the day before.
 */
export const createHabit = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<Habit> => {
  const { name, icon } = parse(newHabitSchema, value)
  const day = localDate(now)
  return db.transaction(tx => {
    const match = findByName(tx, name)
    if (match && !match.archived) throw nameTaken(match)
    if (match) {
      closeOpenPeriod(tx, match.id, day)
      tx
        .update(habits)
        .set({ icon })
        .where(eq(habits.id, match.id))
        .run()
      return requireHabit(tx, match.id)
    }
    const row = tx
      .insert(habits)
      .values({ name, icon, created: day })
      .returning()
      .get()
    return toHabit(row, [])
  })
}

/**
 * Changes a Habit's name, icon, or both. The name must
 * not be any other Habit's, archived ones included.
 */
export const updateHabit = async (
  db: Database,
  value: unknown
): Promise<Habit> => {
  const { id, ...changes } = parse(changesSchema, value)
  return db.transaction(tx => {
    const match = changes.name === undefined
      ? undefined
      : findByName(tx, changes.name, id)
    if (match) throw nameTaken(match)
    const row = tx
      .update(habits)
      .set(changes)
      .where(eq(habits.id, id))
      .returning()
      .get()
    if (!row)
      throw new StorageFailure({ code: 'not-found' })
    return toHabit(row, periodsFor(tx, row.id))
  })
}

/**
 * Archives a Habit: opens an Archive Period on today.
 * Archiving one that is already archived changes
 * nothing.
 */
export const archiveHabit = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<Habit> => {
  const id = parse(idSchema, value)
  const start = localDate(now)
  return db.transaction(tx => {
    const habit = requireHabit(tx, id)
    if (habit.archived) return habit
    tx
      .insert(habitArchivePeriods)
      .values({ habitId: id, start })
      .run()
    return requireHabit(tx, id)
  })
}

/**
 * Brings an archived Habit back. The open period ends
 * the day before today, and a period that would have
 * no days is deleted.
 */
export const unarchiveHabit = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<Habit> => {
  const id = parse(idSchema, value)
  return db.transaction(tx => {
    requireHabit(tx, id)
    closeOpenPeriod(tx, id, localDate(now))
    return requireHabit(tx, id)
  })
}

/**
 * Every Habit's Entries from the range's days,
 * archived Habits' included, by day then Habit.
 */
export const listHabitEntries = async (
  db: Database,
  range: unknown
): Promise<HabitEntry[]> => {
  const { from, to }: DateRange =
    parse(dateRangeSchema, range)
  return db
    .select()
    .from(habitEntries)
    .where(and(
      gte(habitEntries.date, from),
      lte(habitEntries.date, to)
    ))
    .orderBy(
      asc(habitEntries.date),
      asc(habitEntries.habitId)
    )
}

/**
 * Marks a Habit done on a day, not after today.
 * Refuses an archived Habit, and any day inside one
 * of its Archive Periods. Marking it again keeps the
 * one Entry. Days before it was created are allowed.
 */
export const createHabitEntry = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<HabitEntry> => {
  const entry: HabitEntry = parse(entrySchema, value)
  assertNotFuture(entry.date, now)
  return db.transaction(tx => {
    const habit = readHabit(tx, entry.habitId)
    if (!habit)
      throw new StorageFailure({ code: 'not-found' })
    const inside = habit.archivePeriods.some(
      period => covers(period, entry.date)
    )
    if (habit.archived || inside)
      throw new StorageFailure({ code: 'archived-habit' })
    tx
      .insert(habitEntries)
      .values(entry)
      .onConflictDoNothing()
      .run()
    return entry
  })
}

/** Marks a Habit not done on a day. */
export const deleteHabitEntry = async (
  db: Database,
  value: unknown
): Promise<null> => {
  const { habitId, date } = parse(entrySchema, value)
  const deleted = await db
    .delete(habitEntries)
    .where(and(
      eq(habitEntries.habitId, habitId),
      eq(habitEntries.date, date)
    ))
    .returning()
  if (deleted.length === 0)
    throw new StorageFailure({ code: 'not-found' })
  return null
}
