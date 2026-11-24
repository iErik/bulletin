import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  NewRecurringTask,
  Occurrence,
  RecurringTask
} from '@shared/recurring-tasks'
import {
  openDatabase,
  pendingMigrations,
  type Database
} from './database'
import {
  createRecurringTask,
  deleteRecurringTask,
  listOccurrences,
  listRecurringTasks,
  stopRecurringTask
} from './recurring-tasks'
import { memoryDatabase, migrationsFolder } from './testing'

const now = new Date(2026, 10, 24, 12)
const created = now.getTime()
let db: Database
beforeEach(() => {
  db = memoryDatabase()
})

const create = (v: unknown, at = now): Promise<RecurringTask> =>
  createRecurringTask(db, v, at)
const failsWith = (
  p: Promise<unknown>,
  error: object
): Promise<void> =>
  expect(p).rejects.toMatchObject({ error })

const base = (
  o: Partial<NewRecurringTask> = {}
): NewRecurringTask => ({
  title: 'Gym',
  time: null,
  schedule: { kind: 'weekly', weekdays: [1, 4] },
  firstDay: '2026-11-23',
  ...o
})
const saved = (
  o: Partial<RecurringTask> & Pick<RecurringTask, 'id'>
): RecurringTask => ({ ...base(), lastDay: null, created, ...o })
const occ = (
  o: Partial<Occurrence> & Pick<Occurrence, 'scheduled'>
): Occurrence => ({
  ruleId: 1, title: 'Gym', day: o.scheduled, time: null,
  doneAt: null, moves: 0, created, ...o
})
const sched = (schedule: object): object => ({ ...base(), schedule })

describe('createRecurringTask / listRecurringTasks', () => {
  it('saves every schedule kind and lists in order', async () => {
    const t10 = new Date(2026, 10, 24, 10)
    const r1 = await create(base({
      title: '  Gym  ', time: '07:30',
      schedule: { kind: 'weekly', weekdays: [4, 1] }
    }), t10)
    const r2 = await create(base({
      title: 'Water', schedule: { kind: 'days', every: 3 }
    }), new Date(2026, 10, 24, 9))
    const r3 = await create(base({
      title: 'Rent', schedule: { kind: 'monthly', day: 31 }
    }))
    const r4 = await create(base({
      title: 'Leap', schedule: { kind: 'yearly', month: 2, day: 29 }
    }))

    expect(r1).toEqual(saved({
      id: 1, title: 'Gym', time: '07:30',
      schedule: { kind: 'weekly', weekdays: [1, 4] },
      created: t10.getTime()
    }))
    expect((await listRecurringTasks(db)).map(r => r.id))
      .toEqual([r2.id, r1.id, r3.id, r4.id])
  })

  it.each([
    ['title', { ...base(), title: '' }],
    ['title', { ...base(), title: '   ' }],
    ['time', { ...base(), time: '9:30' }],
    ['time', { ...base(), time: '24:00' }],
    ['firstDay', { ...base(), firstDay: '2026-02-30' }],
    ['schedule.kind', sched({ kind: 'hourly' })],
    ['schedule.every', sched({ kind: 'days', every: 0 })],
    ['schedule.every', sched({ kind: 'days', every: 1.5 })],
    ['schedule.weekdays', sched({ kind: 'weekly', weekdays: [] })],
    ['schedule.weekdays', sched({ kind: 'weekly', weekdays: [1, 1] })],
    ['schedule.weekdays.0', sched({ kind: 'weekly', weekdays: [7] })],
    ['schedule.day', sched({ kind: 'monthly', day: 32 })],
    ['schedule.month', sched({ kind: 'yearly', month: 13, day: 1 })],
    ['schedule.day', sched({ kind: 'yearly', month: 2, day: 30 })],
    ['schedule.day', sched({ kind: 'yearly', month: 4, day: 31 })],
    ['', { ...base(), extra: true }],
    ['', null]
  ])('rejects invalid %s: %j', (field, value) =>
    failsWith(create(value), { code: 'invalid-payload', field }))
})

describe('listOccurrences', () => {
  const days = async (from: string, to: string): Promise<string[]> =>
    (await listOccurrences(db, { from, to })).map(o => o.day)

  it('lists every Monday and Thursday of a span', async () => {
    await create(base())
    expect(await listOccurrences(db, {
      from: '2026-11-23', to: '2026-12-06'
    })).toEqual([
      occ({ scheduled: '2026-11-23' }),
      occ({ scheduled: '2026-11-26' }),
      occ({ scheduled: '2026-11-30' }),
      occ({ scheduled: '2026-12-03' })
    ])
  })

  it('clamps monthly on the 31st to Feb 28 and Feb 29', async () => {
    await create(base({
      title: 'Rent',
      schedule: { kind: 'monthly', day: 31 },
      firstDay: '2024-01-01'
    }))
    expect(await days('2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'
    ])
    expect(await days('2024-02-01', '2024-02-29'))
      .toEqual(['2024-02-29'])
  })

  it('handles days, yearly Feb 29, and firstDay bound', async () => {
    await create(base({
      title: 'Every 3',
      schedule: { kind: 'days', every: 3 },
      firstDay: '2026-11-05'
    }))
    await create(base({
      title: 'Leap',
      schedule: { kind: 'yearly', month: 2, day: 29 },
      firstDay: '2024-01-01'
    }))
    expect(await days('2026-11-01', '2026-11-11'))
      .toEqual(['2026-11-05', '2026-11-08', '2026-11-11'])
    expect(await days('2024-02-28', '2025-03-01'))
      .toEqual(['2024-02-29', '2025-02-28'])
  })

  it('orders by day, timed time, created, then ruleId', async () => {
    const daily = {
      schedule: { kind: 'days', every: 1 } as const,
      firstDay: '2026-11-24'
    }
    const items = [
      [{ title: 'Any B' }, new Date(2026, 10, 24, 12)],
      [{ title: 'Late', time: '18:00' }, now],
      [{ title: 'Early', time: '08:00' }, now],
      [{ title: 'Any A' }, new Date(2026, 10, 24, 10)]
    ] as const
    for (const [o, at] of items) await create(base({ ...daily, ...o }), at)

    const list = await listOccurrences(db, {
      from: '2026-11-24', to: '2026-11-24'
    })
    expect(list.map(o => o.title))
      .toEqual(['Early', 'Late', 'Any A', 'Any B'])
  })

  it('rejects an invalid range', () =>
    failsWith(listOccurrences(db, { from: '2026-11-24' }), {
      code: 'invalid-payload', field: 'to'
    }))
})

describe('stopRecurringTask / deleteRecurringTask', () => {
  it('stops on today, keeps today, and lists stopped', async () => {
    await create(base())
    const stopped = await stopRecurringTask(
      db, 1, new Date(2026, 10, 26, 15)
    )
    expect(stopped).toEqual(saved({ id: 1, lastDay: '2026-11-26' }))
    expect(await stopRecurringTask(
      db, 1, new Date(2026, 10, 30, 15)
    )).toEqual(stopped)
    expect(await listRecurringTasks(db)).toEqual([stopped])
    expect((await listOccurrences(db, {
      from: '2026-11-23', to: '2026-12-06'
    })).map(o => o.day)).toEqual(['2026-11-23', '2026-11-26'])
  })

  it('deletes a rule and its occurrences', async () => {
    await create(base())
    expect(await deleteRecurringTask(db, 1)).toBeNull()
    expect(await listRecurringTasks(db)).toEqual([])
    expect(await listOccurrences(db, {
      from: '2026-11-23', to: '2026-12-06'
    })).toEqual([])
  })

  it('rejects missing or invalid ids', async () => {
    await failsWith(stopRecurringTask(db, 1), { code: 'not-found' })
    await failsWith(deleteRecurringTask(db, 1), { code: 'not-found' })
    await failsWith(stopRecurringTask(db, 0), {
      code: 'invalid-payload', field: ''
    })
  })
})

describe('the recurring_tasks table', () => {
  it('enforces title and schedule CHECK constraints', () => {
    const insert = db.$client.prepare(
      'INSERT INTO recurring_tasks (title, time, kind, every, '
      + 'weekdays, month, month_day, first_day, last_day, created) '
      + 'VALUES (?, NULL, ?, ?, ?, ?, ?, ?, NULL, ?)'
    )
    insert.run('Ok', 'days', 2, null, null, null, '2026-11-24', created)
    const bad: unknown[][] = [
      ['   ', 'days', 1, null, null, null],
      ['Ok', 'other', 1, null, null, null],
      ['Ok', 'days', null, null, null, null],
      ['Ok', 'days', 0, null, null, null],
      ['Ok', 'days', 1, 1, null, null],
      ['Ok', 'weekly', null, 0, null, null],
      ['Ok', 'weekly', null, 128, null, null],
      ['Ok', 'monthly', null, null, null, 32],
      ['Ok', 'monthly', null, null, 2, 15],
      ['Ok', 'yearly', null, null, 13, 1],
      ['Ok', 'yearly', null, null, 2, null]
    ]
    for (const row of bad) {
      expect(() => insert.run(
        ...row as never[], '2026-11-24', created
      )).toThrow(/CHECK constraint failed/)
    }
  })
})

describe('recurring_tasks migration', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bulletin-rt-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('persists a Recurring Task across restarts', async () => {
    const file = join(dir, 'bulletin.db')
    const folder = join(dir, 'migrations')
    cpSync(migrationsFolder, folder, { recursive: true })
    const first = openDatabase({ file, migrationsFolder: folder })
    expect(pendingMigrations(first.$client, folder)).toEqual([])
    expect(await createRecurringTask(
      first, base({ time: '07:30' }), now
    )).toEqual(saved({ id: 1, time: '07:30' }))
    first.$client.close()
    const second = openDatabase({ file, migrationsFolder: folder })
    expect(await listRecurringTasks(second))
      .toEqual([saved({ id: 1, time: '07:30' })])
    second.$client.close()
  })
})
