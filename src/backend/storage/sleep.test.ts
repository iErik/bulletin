import { beforeEach, describe, expect, it } from 'vitest'
import type { SleepPeriod } from '@shared/sleep'
import type { Database } from './database'
import {
  createSleep,
  deleteSleep,
  listSleep,
  updateSleep
} from './sleep'
import { memoryDatabase } from './testing'

/** Epoch ms of a local time in 2026, June by default. */
const at = (
  day: number,
  hour: number,
  minute = 0,
  month = 5
): number =>
  new Date(2026, month, day, hour, minute).getTime()

const HOUR = 60 * 60 * 1000
// Noon on 15 June 2026, local time.
const now = new Date(at(15, 12))

let db: Database
beforeEach(() => {
  db = memoryDatabase()
})

const create = (
  start: number,
  end: number
): Promise<SleepPeriod> =>
  createSleep(db, { start, end }, now)
const update = (value: unknown): Promise<SleepPeriod> =>
  updateSleep(db, value, now)
const heads = async (
  from: string,
  to = from
): Promise<number[]> =>
  (await listSleep(db, { from, to }))
    .map(period => period.start)
const all = (): Promise<SleepPeriod[]> =>
  listSleep(db, { from: '2000-01-01', to: '2026-06-15' })
const failsWith = (
  promise: Promise<unknown>,
  error: object
): Promise<void> =>
  expect(promise).rejects.toMatchObject({ error })

describe('createSleep', () => {
  it('saves a Period', async () => {
    const period = await create(at(9, 23), at(10, 7))

    expect(period).toEqual({
      id: expect.any(Number) as number,
      start: at(9, 23),
      end: at(10, 7)
    })
    expect(await all()).toEqual([period])
  })

  it('allows several Periods a day, touching', async () => {
    await create(at(9, 23), at(10, 3))
    await create(at(10, 3), at(10, 7))
    await create(at(10, 14), at(10, 15))

    expect(await all()).toHaveLength(3)
  })

  it('allows exactly 24 hours, ending now', async () => {
    await create(now.getTime() - 24 * HOUR, now.getTime())

    expect(await all()).toHaveLength(1)
  })

  it.each([
    ['ends at its start', at(9, 23), at(9, 23)],
    ['ends before its start', at(10, 7), at(9, 23)]
  ])('rejects a Period that %s', (_, start, end) =>
    failsWith(create(start, end), {
      code: 'reversed-period'
    }))

  it('rejects a Period over 24 hours', () =>
    failsWith(create(at(9, 12), at(10, 12) + 1), {
      code: 'period-too-long'
    }))

  it('rejects a Period ending after now', async () => {
    await failsWith(
      create(at(15, 4), now.getTime() + 1),
      { code: 'future-date' }
    )
    expect(await all()).toEqual([])
  })

  it.each([
    ['inside it', at(10, 0), at(10, 1)],
    ['around it', at(9, 22), at(10, 8)],
    ['its start', at(9, 22), at(9, 23, 1)],
    ['its end', at(10, 6, 59), at(10, 9)],
    ['all of it', at(9, 23), at(10, 7)]
  ])('rejects overlapping %s', async (_, start, end) => {
    const night = await create(at(9, 23), at(10, 7))

    await failsWith(create(start, end), {
      code: 'overlapping-period'
    })
    expect(await all()).toEqual([night])
  })

  it.each([
    ['start', { start: 1.5, end: 2 }],
    ['start', { start: -1, end: 2 }],
    ['start', { start: '1', end: 2 }],
    ['end', { start: 1 }],
    ['', { id: 1, start: 1, end: 2 }],
    ['', null]
  ])('rejects an invalid %s: %j', (field, value) =>
    failsWith(createSleep(db, value, now), {
      code: 'invalid-payload',
      field
    }))
})

describe('listSleep', () => {
  it('lists by the calendar day of the Head', async () => {
    await create(at(7, 6), at(7, 15))
    await create(at(7, 23, 59), at(8, 0))
    await create(at(8, 0), at(8, 1))
    await create(at(8, 12), at(8, 13))

    expect(await heads('2026-06-07'))
      .toEqual([at(7, 6), at(7, 23, 59)])
    expect(await heads('2026-06-08'))
      .toEqual([at(8, 0), at(8, 12)])
  })

  it('lists a range of days, oldest first', async () => {
    for (const day of [3, 1, 4, 2, 5])
      await create(at(day, 12), at(day, 13))
    await create(at(2, 11), at(2, 12))

    expect(await heads('2026-06-02', '2026-06-04'))
      .toEqual([at(2, 11), at(2, 12), at(3, 12), at(4, 12)])
  })

  it('keeps a Period across a month on its Head\'s day',
    async () => {
      const head = at(31, 23, 0, 4)
      await create(head, at(1, 2))
      await create(at(1, 3), at(1, 6))

      expect(await heads('2026-05-31')).toEqual([head])
      expect(await heads('2026-06-01'))
        .toEqual([at(1, 3)])
    })

  it('rejects a range ending before it starts', () =>
    failsWith(
      listSleep(db, {
        from: '2026-06-02',
        to: '2026-06-01'
      }),
      { code: 'invalid-payload', field: 'to' }
    ))
})

describe('updateSleep', () => {
  it('moves a Period, even over itself', async () => {
    const { id } = await create(at(9, 23), at(10, 7))
    const moved = { id, start: at(9, 22), end: at(10, 6) }

    expect(await update(moved)).toEqual(moved)
    expect(await all()).toEqual([moved])
  })

  it('rejects overlapping another Period', async () => {
    await create(at(9, 23), at(10, 7))
    const { id } = await create(at(10, 14), at(10, 15))

    await failsWith(
      update({ id, start: at(10, 6), end: at(10, 15) }),
      { code: 'overlapping-period' }
    )
  })

  it('applies the Period rules', async () => {
    const { id } = await create(at(9, 23), at(10, 7))

    await failsWith(
      update({ id, start: at(10, 7), end: at(9, 23) }),
      { code: 'reversed-period' }
    )
    await failsWith(
      update({ id, start: at(9, 0), end: at(10, 7) }),
      { code: 'period-too-long' }
    )
    await failsWith(
      update({ id, start: at(15, 4), end: at(15, 13) }),
      { code: 'future-date' }
    )
  })

  it('rejects an unknown id', () =>
    failsWith(
      update({ id: 99, start: at(9, 1), end: at(9, 2) }),
      { code: 'not-found' }
    ))

  it('rejects a payload without an id', () =>
    failsWith(update({ start: 1, end: 2 }), {
      code: 'invalid-payload',
      field: 'id'
    }))
})

describe('deleteSleep', () => {
  it('deletes a Period', async () => {
    const { id } = await create(at(9, 23), at(10, 7))

    expect(await deleteSleep(db, id)).toBeNull()
    expect(await all()).toEqual([])
  })

  it('rejects an unknown id', () =>
    failsWith(deleteSleep(db, 99), {
      code: 'not-found'
    }))

  it.each([0, 1.5, '1'])('rejects the id %j', id =>
    failsWith(deleteSleep(db, id), {
      code: 'invalid-payload'
    }))
})

describe('the sleep table', () => {
  it.each([
    ['a reversed Period', 2, 1],
    ['a Period over 24 hours', 0, 24 * HOUR + 1]
  ])('refuses %s', (_, start, end) => {
    const insert = db.$client.prepare(
      'INSERT INTO sleep (start, "end") VALUES (?, ?)'
    )

    expect(() => insert.run(start, end))
      .toThrow(/CHECK constraint failed/)
  })
})
