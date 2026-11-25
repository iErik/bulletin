import { beforeEach, describe, expect, it } from 'vitest'
import type {
  NewRecurringTask,
  RecurringTask
} from '@shared/recurring-tasks'
import type {
  DueReminder,
  ReminderOffset
} from '@shared/reminders'
import type { NewTask, Task } from '@shared/tasks'
import type { Database } from './database'
import {
  listDueReminders,
  markReminderNotified
} from './due-reminders'
import {
  createRecurringTask,
  setOccurrenceDone,
  skipOccurrence,
  stopRecurringTask,
  updateOccurrence,
  updateRecurringTask
} from './recurring-tasks'
import {
  createTask,
  setTaskDone,
  updateTask
} from './tasks'
import { memoryDatabase } from './testing'

const at = (y: number, m: number, d: number, hh = 0, mm = 0): number =>
  new Date(y, m - 1, d, hh, mm).getTime()

const now = new Date(2026, 10, 24, 12)
const m0: ReminderOffset = { kind: 'minutes', minutes: 0 }
const m15: ReminderOffset = { kind: 'minutes', minutes: 15 }
const m30: ReminderOffset = { kind: 'minutes', minutes: 30 }
const d1: ReminderOffset = { kind: 'days', days: 1, time: '18:00' }
const d2: ReminderOffset = { kind: 'days', days: 2, time: '18:00' }

let db: Database
beforeEach(() => {
  db = memoryDatabase()
})

const addTask = (o: Partial<NewTask>, t = now): Promise<Task> =>
  createTask(db, {
    title: 'Task', day: '2026-11-26',
    time: null, reminder: m30, ...o
  }, t)

const addRule = (
  o: Partial<NewRecurringTask>
): Promise<RecurringTask> => createRecurringTask(db, {
  title: 'Gym', time: '08:00', reminder: m30,
  schedule: { kind: 'weekly', weekdays: [1, 4] },
  firstDay: '2026-11-23', ...o
}, now)

const due = (from: number, to: number, only?: boolean):
Promise<DueReminder[]> => listDueReminders(
  db, only ? { from, to, onlyUnnotified: true } : { from, to }
)

const notify = (target: unknown, t = now): Promise<number> =>
  markReminderNotified(db, target, t)

const fails = (p: Promise<unknown>, error: object): Promise<void> =>
  expect(p).rejects.toMatchObject({ error })

const label = (r: DueReminder): string =>
  r.kind === 'task'
    ? `task:${r.task.title}`
    : `occ:${r.occurrence.title}:${r.occurrence.scheduled}`

describe('listDueReminders', () => {
  it('lists 30-min, 1-day, 2-day, 09:00 and midnight Reminders',
    async () => {
      await addTask({ title: 'Dentist', time: '10:00' })
      await addTask({ title: 'Pack', reminder: d1 })
      await addTask({ title: 'Book', day: '2026-11-28', reminder: d2 })
      await addTask({ title: 'Water', reminder: m0 })
      await addTask({ title: 'Flight', day: '2026-11-27', time: '00:15' })

      const list = await due(
        at(2026, 11, 25, 18, 0), at(2026, 11, 26, 23, 45)
      )
      expect(list.map(r => [label(r), r.dueAt])).toEqual([
        ['task:Pack', at(2026, 11, 25, 18, 0)],
        ['task:Water', at(2026, 11, 26, 9, 0)],
        ['task:Dentist', at(2026, 11, 26, 9, 30)],
        ['task:Book', at(2026, 11, 26, 18, 0)],
        ['task:Flight', at(2026, 11, 26, 23, 45)]
      ])
    })

  it('uses inclusive bounds and excludes Someday, plain and done',
    async () => {
      const exact = at(2026, 11, 26, 9, 30)
      const done = await addTask({ title: 'Done', time: '10:00' })
      await setTaskDone(db, { id: done.id, done: true }, now)
      await addTask({ title: 'Someday', day: null, time: '10:00' })
      await addTask({ title: 'Plain', time: '10:00', reminder: null })
      await addTask({ title: 'Keep', time: '10:00' })

      expect((await due(exact, exact)).map(label))
        .toEqual(['task:Keep'])
      expect(await due(exact + 1, exact + 60_000)).toEqual([])
      expect(await due(exact - 60_000, exact - 1)).toEqual([])

      await setTaskDone(db, { id: done.id, done: false })
      expect((await due(exact, exact)).map(label))
        .toEqual(['task:Done', 'task:Keep'])
    })

  it('handles Occurrences: moved, edited, skipped, stopped, versions',
    async () => {
      await addRule({})
      await skipOccurrence(db, { ruleId: 1, scheduled: '2026-11-30' })
      await updateOccurrence(db, {
        ruleId: 1, scheduled: '2026-11-26',
        day: '2026-11-27', time: '10:00', title: 'Swim'
      })
      await updateRecurringTask(
        db, { id: 1, reminder: m15 }, new Date(2026, 10, 25)
      )
      await stopRecurringTask(db, 1, new Date(2026, 11, 3))

      const list = await due(
        at(2026, 11, 23, 0, 0), at(2026, 12, 10, 23, 59)
      )
      expect(list.map(r => [label(r), r.dueAt])).toEqual([
        ['occ:Gym:2026-11-23', at(2026, 11, 23, 7, 30)],
        ['occ:Swim:2026-11-26', at(2026, 11, 27, 9, 45)],
        ['occ:Gym:2026-12-03', at(2026, 12, 3, 7, 45)]
      ])

      await setOccurrenceDone(db, {
        ruleId: 1, scheduled: '2026-12-03', done: true
      }, now)
      expect(await due(
        at(2026, 12, 3, 0, 0), at(2026, 12, 3, 23, 59)
      )).toEqual([])
    })

  it('orders ties deterministically and rejects invalid spans',
    async () => {
      await addRule({
        title: 'Rule', time: '09:00', reminder: m0,
        schedule: { kind: 'days', every: 1 }, firstDay: '2026-11-26'
      })
      await addTask({ title: 'First', time: '09:00', reminder: m0 })
      await addTask(
        { title: 'Later', time: '09:00', reminder: m0 },
        new Date(2026, 10, 24, 13)
      )

      const t = at(2026, 11, 26, 9, 0)
      expect((await due(t, t)).map(label)).toEqual([
        'task:First', 'occ:Rule:2026-11-26', 'task:Later'
      ])
      await fails(due(t + 1, t), { code: 'invalid-payload', field: 'to' })
      await fails(due(1.5, t), { code: 'invalid-payload', field: 'from' })
      await fails(listDueReminders(db, { from: t, to: t, extra: true }),
        { code: 'invalid-payload', field: '' })
    })
})

describe('markReminderNotified', () => {
  it('marks idempotently, filters unnotified and resets on reschedule',
    async () => {
      await addTask({ title: 'Call', time: '10:00' })
      await addRule({
        schedule: { kind: 'weekly', weekdays: [4] },
        firstDay: '2026-11-26'
      })
      const t1 = new Date(2026, 10, 26, 9, 30)
      const t2 = new Date(2026, 10, 26, 9, 35)
      const [s, e] = [at(2026, 11, 26, 0, 0), at(2026, 11, 26, 23, 59)]
      const occTarget = {
        kind: 'occurrence' as const, ruleId: 1, scheduled: '2026-11-26'
      }

      expect(await notify({ kind: 'task', id: 1 }, t1)).toBe(t1.getTime())
      expect(await notify({ kind: 'task', id: 1 }, t2)).toBe(t1.getTime())
      expect((await due(s, e, true)).map(label))
        .toEqual(['occ:Gym:2026-11-26'])

      expect(await notify(occTarget, t1)).toBe(t1.getTime())
      expect(await notify(occTarget, t2)).toBe(t1.getTime())
      expect(await due(s, e, true)).toEqual([])
      expect((await due(s, e)).map(r => r.notifiedAt))
        .toEqual([t1.getTime(), t1.getTime()])

      await updateTask(db, { id: 1, time: '11:00' })
      await updateOccurrence(db, {
        ruleId: 1, scheduled: '2026-11-26', time: '09:00'
      })
      expect((await due(s, e, true)).map(r => [label(r), r.dueAt]))
        .toEqual([
          ['occ:Gym:2026-11-26', at(2026, 11, 26, 8, 30)],
          ['task:Call', at(2026, 11, 26, 10, 30)]
        ])
    })

  it('rejects missing, Someday, plain, off-schedule and skipped',
    async () => {
      await addTask({ title: 'Someday', day: null })
      await addTask({ title: 'Plain', reminder: null })
      await addRule({ reminder: null, firstDay: '2026-11-26' })
      await addRule({
        schedule: { kind: 'weekly', weekdays: [4] },
        firstDay: '2026-11-26'
      })
      await skipOccurrence(db, { ruleId: 2, scheduled: '2026-11-26' })

      for (const target of [
        { kind: 'task', id: 99 },
        { kind: 'task', id: 1 },
        { kind: 'task', id: 2 },
        { kind: 'occurrence', ruleId: 1, scheduled: '2026-11-26' },
        { kind: 'occurrence', ruleId: 2, scheduled: '2026-11-25' },
        { kind: 'occurrence', ruleId: 2, scheduled: '2026-11-26' }
      ]) await fails(notify(target), { code: 'not-found' })
      await fails(notify({ kind: 'other', id: 1 }),
        { code: 'invalid-payload', field: 'kind' })
    })
})
