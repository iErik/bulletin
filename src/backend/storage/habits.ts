import {
  and,
  asc,
  eq,
  gte,
  lte
} from 'drizzle-orm'
import {
  createInsertSchema,
  createSelectSchema
} from 'drizzle-orm/zod'
import { z } from 'zod'
import {
  HABIT_ICONS,
  type Habit,
  type HabitEntry,
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
import { habitEntries, habits } from './schema'

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

const statusSchema = z.enum(['active', 'archived'])

const entrySchema = createInsertSchema(habitEntries, {
  habitId: schema => schema.positive(),
  date: localDateSchema
}).strict()

type Reader = Pick<Database, 'select'>

/**
 * The Habit a row holds. Main writes only known icon
 * keys, so the cast holds.
 */
const toHabit = (
  row: typeof habits.$inferSelect
): Habit => row as Habit

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
  return row && toHabit(row)
}

/** The `name-taken` failure, saying which Habit. */
const nameTaken = (habit: Habit): StorageFailure =>
  new StorageFailure({
    code: 'name-taken',
    habit: habit.archived ? 'archived' : 'active'
  })

/** Active or archived Habits, oldest first. */
export const listHabits = async (
  db: Database,
  value: unknown
): Promise<Habit[]> => {
  const status: HabitStatus = parse(statusSchema, value)
  const rows = await db
    .select()
    .from(habits)
    .where(eq(habits.archived, status === 'archived'))
    .orderBy(asc(habits.created), asc(habits.id))
  return rows.map(toHabit)
}

/**
 * Creates a Habit dated today. If an archived Habit has
 * the name, restores it with the given icon instead.
 */
export const createHabit = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<Habit> => {
  const { name, icon } = parse(newHabitSchema, value)
  return db.transaction(tx => {
    const match = findByName(tx, name)
    if (match && !match.archived) throw nameTaken(match)
    if (match) {
      const restored = { icon, archived: false }
      tx
        .update(habits)
        .set(restored)
        .where(eq(habits.id, match.id))
        .run()
      return { ...match, ...restored }
    }
    const row = tx
      .insert(habits)
      .values({ name, icon, created: localDate(now) })
      .returning()
      .get()
    return toHabit(row)
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
    return toHabit(row)
  })
}

/** Sets whether a Habit, by its id, is archived. */
const setArchived = async (
  db: Database,
  value: unknown,
  archived: boolean
): Promise<Habit> => {
  const id = parse(idSchema, value)
  const [row] = await db
    .update(habits)
    .set({ archived })
    .where(eq(habits.id, id))
    .returning()
  if (!row) throw new StorageFailure({ code: 'not-found' })
  return toHabit(row)
}

/** Archives a Habit. */
export const archiveHabit = (
  db: Database,
  value: unknown
): Promise<Habit> => setArchived(db, value, true)

/** Brings an archived Habit back to the list. */
export const unarchiveHabit = (
  db: Database,
  value: unknown
): Promise<Habit> => setArchived(db, value, false)

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
 * Marks an active Habit done on a day, not after
 * today. Marking it again keeps the one Entry.
 */
export const createHabitEntry = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<HabitEntry> => {
  const entry: HabitEntry = parse(entrySchema, value)
  assertNotFuture(entry.date, now)
  return db.transaction(tx => {
    const habit = tx
      .select({ archived: habits.archived })
      .from(habits)
      .where(eq(habits.id, entry.habitId))
      .get()
    if (!habit)
      throw new StorageFailure({ code: 'not-found' })
    if (habit.archived)
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
