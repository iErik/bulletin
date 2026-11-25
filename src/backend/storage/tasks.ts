import {
  and,
  asc,
  eq,
  gte,
  isNull,
  lte,
  sql
} from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import type { DateRange } from '@shared/storage'
import {
  moveIncrement,
  type NewTask,
  type Task,
  type TaskChanges,
  type TaskDone
} from '@shared/tasks'
import type { Database } from './database'
import {
  dateRangeSchema,
  localDateSchema,
  localTimeSchema
} from './dates'
import { parse, StorageFailure } from './errors'
import {
  fromReminderCols,
  reminderOffsetSchema,
  sameReminderCols,
  toReminderCols
} from './reminders'
import { tasks } from './schema'

const idSchema = createSelectSchema(tasks, {
  id: schema => schema.positive()
}).shape.id

const newTaskSchema = z.strictObject({
  title: z.string().trim().min(1),
  day: localDateSchema.nullable(),
  time: localTimeSchema.nullable(),
  reminder: reminderOffsetSchema.nullable().optional()
})

const changesSchema = z.strictObject({
  id: idSchema,
  title: z.string().trim().min(1).optional(),
  day: localDateSchema.nullable().optional(),
  time: localTimeSchema.nullable().optional(),
  reminder: reminderOffsetSchema.nullable().optional()
}).refine(
  ({ title, day, time, reminder }) => title !== undefined
    || day !== undefined
    || time !== undefined
    || reminder !== undefined,
  'Nothing to change'
)

const doneSchema = z.strictObject({
  id: idSchema,
  done: z.boolean()
})

const toTask = (row: typeof tasks.$inferSelect): Task => ({
  id: row.id,
  title: row.title,
  day: row.day,
  time: row.time,
  reminder: fromReminderCols(row),
  doneAt: row.doneAt,
  created: row.created,
  moves: row.moves
})

/** Tasks planned in the range, ordered for the day. */
export const listTasks = async (
  db: Database,
  range: unknown
): Promise<Task[]> => {
  const { from, to }: DateRange =
    parse(dateRangeSchema, range)
  const rows = await db
    .select()
    .from(tasks)
    .where(and(
      gte(tasks.day, from),
      lte(tasks.day, to)
    ))
    .orderBy(
      asc(tasks.day),
      sql`${tasks.time} IS NULL`,
      asc(tasks.time),
      asc(tasks.id)
    )
  return rows.map(toTask)
}

/** Someday Tasks, oldest first. */
export const listSomedayTasks = async (
  db: Database
): Promise<Task[]> => {
  const rows = await db
    .select()
    .from(tasks)
    .where(isNull(tasks.day))
    .orderBy(asc(tasks.created), asc(tasks.id))
  return rows.map(toTask)
}

/** Creates a Task; `created` is now, not done. */
export const createTask = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<Task> => {
  const task: NewTask = parse(newTaskSchema, value)
  const [row] = await db
    .insert(tasks)
    .values({
      title: task.title,
      day: task.day,
      time: task.time,
      ...toReminderCols(task.reminder ?? null),
      reminderNotifiedAt: null,
      doneAt: null,
      created: now.getTime(),
      moves: 0
    })
    .returning()
  return toTask(row)
}

/** Changes fields; a later day raises `moves`. */
export const updateTask = async (
  db: Database,
  value: unknown
): Promise<Task> => {
  const changes: TaskChanges = parse(changesSchema, value)
  return db.transaction(tx => {
    const existing = tx
      .select()
      .from(tasks)
      .where(eq(tasks.id, changes.id))
      .get()
    if (!existing)
      throw new StorageFailure({ code: 'not-found' })

    const patch: Partial<typeof tasks.$inferInsert> = {}
    let dueChanged = false
    if (changes.title !== undefined)
      patch.title = changes.title
    if (changes.time !== undefined) {
      patch.time = changes.time
      if (changes.time !== existing.time) dueChanged = true
    }
    if (changes.day !== undefined) {
      patch.day = changes.day
      patch.moves = existing.moves
        + moveIncrement(existing.day, changes.day)
      if (changes.day !== existing.day) dueChanged = true
    }
    if (changes.reminder !== undefined) {
      const cols = toReminderCols(changes.reminder)
      Object.assign(patch, cols)
      if (!sameReminderCols(existing, cols))
        dueChanged = true
    }
    if (dueChanged) patch.reminderNotifiedAt = null

    const row = tx
      .update(tasks)
      .set(patch)
      .where(eq(tasks.id, changes.id))
      .returning()
      .get()
    if (!row)
      throw new StorageFailure({ code: 'not-found' })
    return toTask(row)
  })
}

/** Sets or clears `doneAt`; redone keeps the first. */
export const setTaskDone = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<Task> => {
  const change: TaskDone = parse(doneSchema, value)
  return db.transaction(tx => {
    const existing = tx
      .select()
      .from(tasks)
      .where(eq(tasks.id, change.id))
      .get()
    if (!existing)
      throw new StorageFailure({ code: 'not-found' })

    let doneAt = existing.doneAt
    if (!change.done) doneAt = null
    else if (doneAt === null) doneAt = now.getTime()

    const row = tx
      .update(tasks)
      .set({ doneAt })
      .where(eq(tasks.id, change.id))
      .returning()
      .get()
    if (!row)
      throw new StorageFailure({ code: 'not-found' })
    return toTask(row)
  })
}

/** Deletes a Task by its id. */
export const deleteTask = async (
  db: Database,
  value: unknown
): Promise<null> => {
  const id = parse(idSchema, value)
  const deleted = await db
    .delete(tasks)
    .where(eq(tasks.id, id))
    .returning()
  if (deleted.length === 0)
    throw new StorageFailure({ code: 'not-found' })
  return null
}
