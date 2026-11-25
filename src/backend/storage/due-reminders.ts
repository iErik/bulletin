import {
  and,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  or
} from 'drizzle-orm'
import { z } from 'zod'
import { localDate, shiftDay } from '@shared/dates'
import { compareForDay } from '@shared/recurring-tasks'
import {
  reminderDueAt,
  type DueReminder,
  type DueReminderQuery,
  type ReminderTarget
} from '@shared/reminders'
import type { Database } from './database'
import { localDateSchema } from './dates'
import { parse, StorageFailure } from './errors'
import {
  expandOccurrences,
  requireOccurrence
} from './recurring-tasks'
import { fromReminderCols } from './reminders'
import { occurrences, tasks } from './schema'
import { toTask } from './tasks'

const momentSchema = z.number().int().refine(
  n => !Number.isNaN(new Date(n).getTime()),
  'Not a timestamp'
)

const dueQuerySchema = z.strictObject({
  from: momentSchema,
  to: momentSchema,
  onlyUnnotified: z.boolean().optional()
}).refine(({ from, to }) => from <= to, {
  path: ['to'],
  message: 'Range ends before it starts'
})

const positiveId = z.number().int().positive()
const targetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('task'), id: positiveId }),
  z.strictObject({
    kind: z.literal('occurrence'),
    ruleId: positiveId,
    scheduled: localDateSchema
  })
])

const compareDue = (a: DueReminder, b: DueReminder): number =>
  a.dueAt - b.dueAt
  || compareForDay(
    a.kind === 'task' ? a.task : a.occurrence,
    b.kind === 'task' ? b.task : b.occurrence
  )
  || (a.kind === b.kind ? 0 : a.kind === 'task' ? -1 : 1)
  || (a.kind === 'task' && b.kind === 'task'
    ? a.task.id - b.task.id
    : a.kind === 'occurrence' && b.kind === 'occurrence'
      ? a.occurrence.ruleId - b.occurrence.ruleId
        || a.occurrence.scheduled.localeCompare(
          b.occurrence.scheduled
        )
      : 0)

/** Undone Reminders due in `from`..`to`, soonest first. */
export const listDueReminders = async (
  db: Database,
  value: unknown
): Promise<DueReminder[]> => {
  const { from, to, onlyUnnotified }: DueReminderQuery =
    parse(dueQuerySchema, value)
  const scanFrom = localDate(new Date(from))
  const scanTo = shiftDay(localDate(new Date(to)), 2)

  return db.transaction(tx => {
    const due: DueReminder[] = []
    const taskRows = tx.select().from(tasks).where(and(
      isNull(tasks.doneAt),
      gte(tasks.day, scanFrom),
      lte(tasks.day, scanTo),
      or(
        isNotNull(tasks.reminderMinutes),
        isNotNull(tasks.reminderDays)
      ),
      ...(onlyUnnotified
        ? [isNull(tasks.reminderNotifiedAt)]
        : [])
    )).all()

    const push = (dueAt: number, item: DueReminder): void => {
      if (dueAt >= from && dueAt <= to) due.push(item)
    }
    for (const row of taskRows) {
      const task = toTask(row)
      if (task.day === null || task.reminder === null) continue
      const dueAt = reminderDueAt(task.day, task.time, task.reminder)
      push(dueAt, {
        kind: 'task', task, offset: task.reminder,
        dueAt, notifiedAt: row.reminderNotifiedAt
      })
    }
    for (const { occurrence, notifiedAt } of
      expandOccurrences(tx, { from: scanFrom, to: scanTo })) {
      if (occurrence.doneAt !== null
        || occurrence.reminder === null
        || (onlyUnnotified && notifiedAt !== null)) continue
      const dueAt = reminderDueAt(
        occurrence.day, occurrence.time, occurrence.reminder
      )
      push(dueAt, {
        kind: 'occurrence', occurrence,
        offset: occurrence.reminder, dueAt, notifiedAt
      })
    }
    return due.sort(compareDue)
  })
}

/** Records a Reminder as notified; keeps the first time. */
export const markReminderNotified = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<number> => {
  const target: ReminderTarget = parse(targetSchema, value)
  return db.transaction(tx => {
    if (target.kind === 'task') {
      const row = tx.select().from(tasks)
        .where(eq(tasks.id, target.id)).get()
      if (!row || row.day === null
        || fromReminderCols(row) === null)
        throw new StorageFailure({ code: 'not-found' })
      if (row.reminderNotifiedAt !== null)
        return row.reminderNotifiedAt
      const notifiedAt = now.getTime()
      tx.update(tasks).set({ reminderNotifiedAt: notifiedAt })
        .where(eq(tasks.id, target.id)).run()
      return notifiedAt
    }

    const { rule, existing } = requireOccurrence(tx, {
      ruleId: target.ruleId, scheduled: target.scheduled
    })
    if (rule.reminder === null)
      throw new StorageFailure({ code: 'not-found' })
    if (existing?.reminderNotifiedAt != null)
      return existing.reminderNotifiedAt
    const notifiedAt = now.getTime()
    tx.insert(occurrences).values({
      ruleId: target.ruleId,
      scheduled: target.scheduled,
      reminderNotifiedAt: notifiedAt
    }).onConflictDoUpdate({
      target: [occurrences.ruleId, occurrences.scheduled],
      set: { reminderNotifiedAt: notifiedAt }
    }).run()
    return notifiedAt
  })
}
