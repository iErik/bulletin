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
  localDateSchema
} from './dates'
import { parse, StorageFailure } from './errors'
import { tasks } from './schema'

const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)

const idSchema = createSelectSchema(tasks, {
  id: schema => schema.positive()
}).shape.id

const newTaskSchema = z.strictObject({
  title: z.string().trim().min(1),
  day: localDateSchema.nullable(),
  time: localTimeSchema.nullable()
})

const changesSchema = z.strictObject({
  id: idSchema,
  title: z.string().trim().min(1).optional(),
  day: localDateSchema.nullable().optional(),
  time: localTimeSchema.nullable().optional()
}).refine(
  ({ title, day, time }) => title !== undefined
    || day !== undefined
    || time !== undefined,
  'Nothing to change'
)

const doneSchema = z.strictObject({
  id: idSchema,
  done: z.boolean()
})

const toTask = (row: typeof tasks.$inferSelect): Task =>
  row

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

    const patch: {
      title?: string
      day?: string | null
      time?: string | null
      moves?: number
    } = {}
    if (changes.title !== undefined)
      patch.title = changes.title
    if (changes.time !== undefined)
      patch.time = changes.time
    if (changes.day !== undefined) {
      patch.day = changes.day
      patch.moves = existing.moves
        + moveIncrement(existing.day, changes.day)
    }

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
