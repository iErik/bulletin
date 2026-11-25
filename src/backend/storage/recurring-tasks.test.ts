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
  OccurrenceKey,
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
  setOccurrenceDone,
  skipOccurrence,
  stopRecurringTask,
  updateOccurrence,
  updateRecurringTask
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
): RecurringTask => ({
  ...base(), reminder: null, lastDay: null, created, ...o
})
const occ = (
  o: Partial<Occurrence> & Pick<Occurrence, 'scheduled'>
): Occurrence => ({
  ruleId: 1, title: 'Gym', day: o.scheduled, time: null,
  reminder: null, doneAt: null, moves: 0, created, ...o
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

  it('deletes a rule and cascades its occurrences', async () => {
    await create(base())
    await updateOccurrence(db, {
      ruleId: 1, scheduled: '2026-11-23', title: 'Legs'
    })
    expect(await deleteRecurringTask(db, 1)).toBeNull()
    expect(await listRecurringTasks(db)).toEqual([])
    expect(await listOccurrences(db, {
      from: '2026-11-23', to: '2026-12-06'
    })).toEqual([])
    const leftover = db.$client
      .prepare('SELECT * FROM occurrences WHERE rule_id = 1')
      .all()
    expect(leftover).toEqual([])
  })

  it('rejects missing or invalid ids', async () => {
    await failsWith(stopRecurringTask(db, 1), { code: 'not-found' })
    await failsWith(deleteRecurringTask(db, 1), { code: 'not-found' })
    await failsWith(stopRecurringTask(db, 0), {
      code: 'invalid-payload', field: ''
    })
  })
})

describe('occurrence changes', () => {
  const key = (scheduled: string): OccurrenceKey =>
    ({ ruleId: 1, scheduled })

  it('changes only the one Occurrence, not others or the rule',
    async () => {
      await create(base({ time: '07:30' }))
      const t1 = new Date(2026, 10, 23, 8)
      const edited = await updateOccurrence(db, {
        ...key('2026-11-23'),
        title: '  Leg day  ',
        day: '2026-11-25',
        time: '09:00'
      })
      const done = await setOccurrenceDone(db, {
        ...key('2026-11-23'), done: true
      }, t1)

      expect(edited).toEqual(occ({
        scheduled: '2026-11-23',
        title: 'Leg day',
        day: '2026-11-25',
        time: '09:00',
        moves: 1
      }))
      expect(done).toEqual({ ...edited, doneAt: t1.getTime() })
      expect(await listRecurringTasks(db))
        .toEqual([saved({ id: 1, time: '07:30' })])
      expect(await listOccurrences(db, {
        from: '2026-11-23', to: '2026-11-26'
      })).toEqual([
        done,
        occ({ scheduled: '2026-11-26', time: '07:30' })
      ])
    })

  it('counts only later-day moves', async () => {
    await create(base())
    const s = key('2026-11-23')
    expect(await updateOccurrence(db, {
      ...s, day: '2026-11-23'
    })).toMatchObject({ day: '2026-11-23', moves: 0 })
    expect(await updateOccurrence(db, {
      ...s, day: '2026-11-22'
    })).toMatchObject({ day: '2026-11-22', moves: 0 })
    expect(await updateOccurrence(db, {
      ...s, day: '2026-11-25'
    })).toMatchObject({ day: '2026-11-25', moves: 1 })
    expect(await updateOccurrence(db, {
      ...s, day: '2026-11-23'
    })).toMatchObject({ day: '2026-11-23', moves: 1 })
    expect(await updateOccurrence(db, {
      ...s, day: '2026-11-24'
    })).toMatchObject({ day: '2026-11-24', moves: 2 })
  })

  it('keeps the first doneAt when redone and clears on false',
    async () => {
      await create(base())
      const t1 = new Date(2026, 10, 23, 8)
      const t2 = new Date(2026, 10, 23, 9)
      const s = key('2026-11-23')
      await updateOccurrence(db, { ...s, title: 'Swim' })

      expect(await setOccurrenceDone(db, { ...s, done: true }, t1))
        .toMatchObject({ title: 'Swim', doneAt: t1.getTime() })
      expect(await setOccurrenceDone(db, { ...s, done: true }, t2))
        .toMatchObject({ title: 'Swim', doneAt: t1.getTime() })
      expect(await setOccurrenceDone(db, { ...s, done: false }, t2))
        .toMatchObject({ title: 'Swim', doneAt: null })
    })

  it('distinguishes time cleared to null from unchanged time',
    async () => {
      await create(base({ time: '07:30' }))
      const s = key('2026-11-23')
      await updateOccurrence(db, { ...s, title: 'Cardio' })
      expect(await listOccurrences(db, {
        from: '2026-11-23', to: '2026-11-23'
      })).toEqual([occ({
        scheduled: '2026-11-23', title: 'Cardio', time: '07:30'
      })])

      await updateOccurrence(db, { ...s, time: null })
      await updateOccurrence(db, { ...s, title: 'Run' })
      expect(await listOccurrences(db, {
        from: '2026-11-23', to: '2026-11-23'
      })).toEqual([occ({
        scheduled: '2026-11-23', title: 'Run', time: null
      })])
    })

  it('includes moved-in and drops moved-out Occurrences',
    async () => {
      await create(base())
      await updateOccurrence(db, {
        ...key('2026-11-23'), day: '2026-11-25'
      })
      await updateOccurrence(db, {
        ...key('2026-11-26'), day: '2026-11-28'
      })
      expect((await listOccurrences(db, {
        from: '2026-11-24', to: '2026-11-27'
      })).map(o => [o.scheduled, o.day]))
        .toEqual([['2026-11-23', '2026-11-25']])
      expect((await listOccurrences(db, {
        from: '2026-11-28', to: '2026-11-29'
      })).map(o => [o.scheduled, o.day]))
        .toEqual([['2026-11-26', '2026-11-28']])
    })

  it('skips only that Occurrence and rejects later changes',
    async () => {
      await create(base())
      const s = key('2026-11-23')
      expect(await skipOccurrence(db, s)).toBeNull()
      expect((await listOccurrences(db, {
        from: '2026-11-23', to: '2026-11-26'
      })).map(o => o.scheduled)).toEqual(['2026-11-26'])

      await failsWith(skipOccurrence(db, s), { code: 'not-found' })
      await failsWith(
        updateOccurrence(db, { ...s, title: 'X' }),
        { code: 'not-found' }
      )
      await failsWith(
        setOccurrenceDone(db, { ...s, done: true }),
        { code: 'not-found' }
      )
    })

  it('keeps past/today changes on stop and drops future ones',
    async () => {
      await create(base())
      const doneAt = new Date(2026, 10, 23, 8)
      await updateOccurrence(db, {
        ...key('2026-11-23'), title: 'Done gym'
      })
      await setOccurrenceDone(db, {
        ...key('2026-11-23'), done: true
      }, doneAt)
      await updateOccurrence(db, {
        ...key('2026-11-26'), day: '2026-11-27'
      })
      // Future Occurrence moved earlier before today:
      await updateOccurrence(db, {
        ...key('2026-11-30'), day: '2026-11-24'
      })
      await stopRecurringTask(db, 1, new Date(2026, 10, 26, 15))

      expect(await listOccurrences(db, {
        from: '2026-11-23', to: '2026-12-06'
      })).toEqual([
        occ({
          scheduled: '2026-11-23',
          title: 'Done gym',
          doneAt: doneAt.getTime()
        }),
        occ({
          scheduled: '2026-11-26',
          day: '2026-11-27',
          moves: 1
        })
      ])
      await failsWith(
        updateOccurrence(db, {
          ...key('2026-11-30'), title: 'Nope'
        }),
        { code: 'not-found' }
      )
    })

  it('rejects unknown rule, off-schedule day, or invalid payloads',
    async () => {
      await create(base())
      await failsWith(
        updateOccurrence(db, {
          ruleId: 9, scheduled: '2026-11-23', title: 'X'
        }),
        { code: 'not-found' }
      )
      await failsWith(
        updateOccurrence(db, {
          ruleId: 1, scheduled: '2026-11-24', title: 'X'
        }),
        { code: 'not-found' }
      )
      await failsWith(
        skipOccurrence(db, { ruleId: 1, scheduled: '2026-11-22' }),
        { code: 'not-found' }
      )
      await failsWith(
        updateOccurrence(db, {
          ruleId: 1, scheduled: '2026-11-23', day: null
        }),
        { code: 'invalid-payload', field: 'day' }
      )
      await failsWith(
        updateOccurrence(db, {
          ruleId: 1, scheduled: '2026-11-23', title: '   '
        }),
        { code: 'invalid-payload', field: 'title' }
      )
      await failsWith(
        updateOccurrence(db, {
          ruleId: 1, scheduled: '2026-11-23'
        }),
        { code: 'invalid-payload', field: '' }
      )
    })
})

describe('updateRecurringTask', () => {
  const update = (v: unknown, at = now): Promise<RecurringTask> =>
    updateRecurringTask(db, v, at)

  it('keeps past title, time and schedule while applying from today',
    async () => {
      await create(base({ time: '07:30' }))
      const doneAt = new Date(2026, 10, 23, 8)
      await setOccurrenceDone(db, {
        ruleId: 1, scheduled: '2026-11-23', done: true
      }, doneAt)

      // Today is Thu 2026-11-26: switch weekly Mon/Thu -> Tue/Thu
      const edited = await update({
        id: 1,
        title: '  Workout  ',
        time: '08:00',
        schedule: { kind: 'weekly', weekdays: [4, 2] }
      }, new Date(2026, 10, 26, 10))

      expect(edited).toEqual(saved({
        id: 1,
        title: 'Workout',
        time: '08:00',
        schedule: { kind: 'weekly', weekdays: [2, 4] }
      }))
      expect(await listOccurrences(db, {
        from: '2026-11-23', to: '2026-12-03'
      })).toEqual([
        occ({
          scheduled: '2026-11-23',
          title: 'Gym',
          time: '07:30',
          doneAt: doneAt.getTime()
        }),
        occ({
          scheduled: '2026-11-26', title: 'Workout', time: '08:00'
        }),
        occ({
          scheduled: '2026-12-01', title: 'Workout', time: '08:00'
        }),
        occ({
          scheduled: '2026-12-03', title: 'Workout', time: '08:00'
        })
      ])
    })

  it('keeps surviving future overrides and deletes orphaned ones',
    async () => {
      await create(base({ time: '07:30' }))
      await updateOccurrence(db, {
        ruleId: 1, scheduled: '2026-11-26', title: 'Leg day'
      })
      await updateOccurrence(db, {
        ruleId: 1, scheduled: '2026-11-30', title: 'Dropped Mon'
      })
      await updateOccurrence(db, {
        ruleId: 1, scheduled: '2026-12-03', time: null
      })

      await update({
        id: 1,
        title: 'Workout',
        time: '08:00',
        schedule: { kind: 'weekly', weekdays: [4] }
      }, new Date(2026, 10, 26, 10))

      expect(await listOccurrences(db, {
        from: '2026-11-26', to: '2026-12-03'
      })).toEqual([
        occ({
          scheduled: '2026-11-26', title: 'Leg day', time: '08:00'
        }),
        occ({
          scheduled: '2026-12-03', title: 'Workout', time: null
        })
      ])
      const leftover = db.$client
        .prepare('SELECT scheduled FROM occurrences WHERE rule_id = 1')
        .all()
      expect(leftover).toEqual([
        { scheduled: '2026-11-26' },
        { scheduled: '2026-12-03' }
      ])
    })

  it('replaces a rule in place before its firstDay', async () => {
    await create(base({ firstDay: '2026-12-01' }))
    await updateOccurrence(db, {
      ruleId: 1, scheduled: '2026-12-03', title: 'Old Thu'
    })
    const edited = await update({
      id: 1,
      title: 'Run',
      firstDay: '2026-11-20',
      schedule: { kind: 'weekly', weekdays: [1] }
    }, new Date(2026, 10, 25, 10))

    expect(edited).toEqual(saved({
      id: 1,
      title: 'Run',
      firstDay: '2026-11-20',
      schedule: { kind: 'weekly', weekdays: [1] }
    }))
    const versions = db.$client
      .prepare('SELECT * FROM recurring_task_versions')
      .all()
    expect(versions).toEqual([])
    const leftover = db.$client
      .prepare('SELECT * FROM occurrences WHERE rule_id = 1')
      .all()
    expect(leftover).toEqual([])
  })

  it('handles multiple edits, same-day edits, and days cadence',
    async () => {
      await create(base({
        schedule: { kind: 'days', every: 3 },
        firstDay: '2026-11-01'
      }))
      // Nov 1, 4, 7, 10, 13, 16, 19
      await update({ id: 1, title: 'V2a' }, new Date(2026, 10, 11))
      await update({ id: 1, title: 'V2b' }, new Date(2026, 10, 11))
      await update({ id: 1, time: '09:00' }, new Date(2026, 10, 14))

      expect(await listOccurrences(db, {
        from: '2026-11-01', to: '2026-11-19'
      })).toEqual([
        occ({ scheduled: '2026-11-01', title: 'Gym' }),
        occ({ scheduled: '2026-11-04', title: 'Gym' }),
        occ({ scheduled: '2026-11-07', title: 'Gym' }),
        occ({ scheduled: '2026-11-10', title: 'Gym' }),
        occ({ scheduled: '2026-11-13', title: 'V2b' }),
        occ({ scheduled: '2026-11-16', title: 'V2b', time: '09:00' }),
        occ({ scheduled: '2026-11-19', title: 'V2b', time: '09:00' })
      ])
    })

  it('moves the every-N anchor on firstDay and rejects past ones',
    async () => {
      await create(base({
        schedule: { kind: 'days', every: 3 },
        firstDay: '2026-11-01'
      }))
      await failsWith(
        update({ id: 1, firstDay: '2026-11-09' }, new Date(2026, 10, 10)),
        { code: 'invalid-payload', field: 'firstDay' }
      )
      await update(
        { id: 1, firstDay: '2026-11-12' },
        new Date(2026, 10, 10)
      )
      // Still started (has a past version), so past firstDay fails:
      await failsWith(
        update({ id: 1, firstDay: '2026-11-10' }, new Date(2026, 10, 11)),
        { code: 'invalid-payload', field: 'firstDay' }
      )
      expect((await listOccurrences(db, {
        from: '2026-11-07', to: '2026-11-18'
      })).map(o => o.scheduled)).toEqual([
        '2026-11-07', '2026-11-12', '2026-11-15', '2026-11-18'
      ])
    })

  it('lets past Occurrences be edited or done under their old version',
    async () => {
      await create(base({ time: '07:30' }))
      await update({
        id: 1,
        title: 'Yoga',
        time: '08:00',
        schedule: { kind: 'weekly', weekdays: [2] }
      }, new Date(2026, 10, 24))

      const doneAt = new Date(2026, 10, 24, 9)
      expect(await setOccurrenceDone(db, {
        ruleId: 1, scheduled: '2026-11-23', done: true
      }, doneAt)).toEqual(occ({
        scheduled: '2026-11-23',
        title: 'Gym',
        time: '07:30',
        doneAt: doneAt.getTime()
      }))
      await failsWith(
        setOccurrenceDone(db, {
          ruleId: 1, scheduled: '2026-11-17', done: true
        }),
        { code: 'not-found' }
      )
    })

  it('keeps a past Occurrence moved past today on its version',
    async () => {
      await create(base())
      await updateOccurrence(db, {
        ruleId: 1, scheduled: '2026-11-23', day: '2026-11-28'
      })

      await update({
        id: 1,
        title: 'Yoga',
        schedule: { kind: 'weekly', weekdays: [2] }
      }, new Date(2026, 10, 25))

      expect(await listOccurrences(db, {
        from: '2026-11-28', to: '2026-11-28'
      })).toEqual([occ({
        scheduled: '2026-11-23', day: '2026-11-28', moves: 1
      })])
    })

  it('saves no version when nothing changes', async () => {
    await create(base())
    expect(await update({ id: 1, title: 'Gym' }))
      .toEqual(saved({ id: 1 }))
    expect(db.$client
      .prepare('SELECT * FROM recurring_task_versions')
      .all()).toEqual([])
  })

  it('respects stop and cascades versions on delete', async () => {
    await create(base())
    await stopRecurringTask(db, 1, new Date(2026, 10, 26))
    await update({ id: 1, title: 'After stop' }, new Date(2026, 10, 30))
    expect(await listOccurrences(db, {
      from: '2026-11-23', to: '2026-12-06'
    })).toEqual([
      occ({ scheduled: '2026-11-23', title: 'Gym' }),
      occ({ scheduled: '2026-11-26', title: 'Gym' })
    ])

    await deleteRecurringTask(db, 1)
    const leftover = db.$client
      .prepare('SELECT * FROM recurring_task_versions WHERE rule_id = 1')
      .all()
    expect(leftover).toEqual([])
  })

  it('snapshots Reminder on edit all and clears future notifiedAt',
    async () => {
      const m15 = { kind: 'minutes' as const, minutes: 15 as const }
      const d1 = {
        kind: 'days' as const, days: 1 as const, time: '18:00'
      }
      await create(base({ time: '07:30', reminder: m15 }))
      // Seed notifiedAt on past Mon, future Thu, and future Mon
      // (future Mon has an overridden time).
      const seed = db.$client.prepare(
        'INSERT INTO occurrences (rule_id, scheduled, time, '
        + 'time_changed, reminder_notified_at) VALUES (1, ?, ?, ?, ?)'
      )
      seed.run('2026-11-23', null, 0, 100)
      seed.run('2026-11-26', null, 0, 200)
      seed.run('2026-11-30', '09:00', 1, 300)

      const notified = (day: string): unknown =>
        (db.$client.prepare(
          'SELECT reminder_notified_at FROM occurrences '
          + 'WHERE rule_id = 1 AND scheduled = ?'
        ).get(day) as { reminder_notified_at: unknown })
          .reminder_notified_at

      // Rule time change clears only non-overridden future rows.
      await update(
        { id: 1, time: '08:00' },
        new Date(2026, 10, 25)
      )
      expect([
        notified('2026-11-23'),
        notified('2026-11-26'),
        notified('2026-11-30')
      ]).toEqual([100, null, 300])

      // Rule reminder change clears all future rows, keeps past.
      await update(
        { id: 1, reminder: d1 },
        new Date(2026, 10, 25)
      )
      expect([
        notified('2026-11-23'),
        notified('2026-11-30')
      ]).toEqual([100, null])
      expect(await listOccurrences(db, {
        from: '2026-11-23', to: '2026-11-30'
      })).toEqual([
        occ({ scheduled: '2026-11-23', time: '07:30', reminder: m15 }),
        occ({ scheduled: '2026-11-26', time: '08:00', reminder: d1 }),
        occ({ scheduled: '2026-11-30', time: '09:00', reminder: d1 })
      ])

      // Occurrence title edit keeps notifiedAt; day/time clears it.
      db.$client.prepare(
        'UPDATE occurrences SET reminder_notified_at = 400 '
        + 'WHERE rule_id = 1 AND scheduled = ?'
      ).run('2026-11-26')
      await updateOccurrence(db, {
        ruleId: 1, scheduled: '2026-11-26', title: 'Swim'
      })
      expect(notified('2026-11-26')).toBe(400)
      await updateOccurrence(db, {
        ruleId: 1, scheduled: '2026-11-26', day: '2026-11-27'
      })
      expect(notified('2026-11-26')).toBeNull()
    })

  it('rejects missing rule or invalid payloads', async () => {
    await create(base())
    await failsWith(
      update({ id: 9, title: 'X' }),
      { code: 'not-found' }
    )
    await failsWith(
      update({ id: 1 }),
      { code: 'invalid-payload', field: '' }
    )
    await failsWith(
      update({ id: 1, title: '   ' }),
      { code: 'invalid-payload', field: 'title' }
    )
    await failsWith(
      update({ id: 1, time: '25:00' }),
      { code: 'invalid-payload', field: 'time' }
    )
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

  it('enforces occurrences CHECK and foreign-key constraints',
    async () => {
      await create(base())
      const insert = db.$client.prepare(
        'INSERT INTO occurrences (rule_id, scheduled, title, '
        + 'time_changed, moves, skipped) VALUES (?, ?, ?, ?, ?, ?)'
      )
      expect(() => insert.run(1, '2026-11-23', '  ', 0, 0, 0))
        .toThrow(/CHECK constraint failed/)
      expect(() => insert.run(1, '2026-11-23', null, 0, -1, 0))
        .toThrow(/CHECK constraint failed/)
      expect(() => insert.run(1, '2026-11-23', null, 2, 0, 0))
        .toThrow(/CHECK constraint failed/)
      expect(() => insert.run(99, '2026-11-23', null, 0, 0, 0))
        .toThrow(/FOREIGN KEY constraint failed/)
    })

  it('enforces recurring_task_versions CHECK and FK constraints',
    async () => {
      await create(base())
      const insert = db.$client.prepare(
        'INSERT INTO recurring_task_versions (rule_id, title, time, '
        + 'kind, every, weekdays, month, month_day, first_day, last_day) '
        + 'VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)'
      )
      expect(() => insert.run(
        1, '  ', 'days', 1, null, null, null, '2026-11-23', '2026-11-25'
      )).toThrow(/CHECK constraint failed/)
      expect(() => insert.run(
        1, 'Ok', 'days', 1, null, null, null, '2026-11-25', '2026-11-24'
      )).toThrow(/CHECK constraint failed/)
      expect(() => insert.run(
        1, 'Ok', 'days', 0, null, null, null, '2026-11-23', '2026-11-25'
      )).toThrow(/CHECK constraint failed/)
      expect(() => insert.run(
        99, 'Ok', 'days', 1, null, null, null, '2026-11-23', '2026-11-25'
      )).toThrow(/FOREIGN KEY constraint failed/)
    })
  it('enforces reminder CHECK on rules and versions', async () => {
    await create(base())
    const badRule = db.$client.prepare(
      'INSERT INTO recurring_tasks (title, kind, every, '
      + 'first_day, created, reminder_minutes, reminder_days, '
      + 'reminder_time) VALUES (\'Ok\', \'days\', 1, '
      + '\'2026-11-24\', ?, ?, ?, ?)'
    )
    expect(() => badRule.run(created, 5, null, null))
      .toThrow(/CHECK constraint failed/)
    expect(() => badRule.run(created, null, 1, null))
      .toThrow(/CHECK constraint failed/)
    const badVer = db.$client.prepare(
      'INSERT INTO recurring_task_versions (rule_id, title, '
      + 'kind, every, first_day, last_day, reminder_minutes, '
      + 'reminder_days, reminder_time) VALUES (1, \'Ok\', '
      + '\'days\', 1, \'2026-11-23\', \'2026-11-25\', ?, ?, ?)'
    )
    expect(() => badVer.run(15, 1, null))
      .toThrow(/CHECK constraint failed/)
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
    const reminder = {
      kind: 'days' as const,
      days: 1 as const,
      time: '18:00'
    }
    expect(await createRecurringTask(
      first, base({ time: '07:30', reminder }), now
    )).toEqual(saved({ id: 1, time: '07:30', reminder }))
    first.$client.close()
    const second = openDatabase({ file, migrationsFolder: folder })
    expect(await listRecurringTasks(second))
      .toEqual([saved({ id: 1, time: '07:30', reminder })])
    second.$client.close()
  })
})
