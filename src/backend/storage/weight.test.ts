import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from './database'
import { memoryDatabase } from './testing'
import {
  createWeight,
  deleteWeight,
  listWeight,
  updateWeight
} from './weight'

// Noon on 15 June 2026, local time.
const now = new Date(2026, 5, 15, 12)
const today = '2026-06-15'

let db: Database
beforeEach(() => {
  db = memoryDatabase()
})

const create = (value: unknown) =>
  createWeight(db, value, now)
const all = () =>
  listWeight(db, { from: '2000-01-01', to: today })
const failsWith = (
  promise: Promise<unknown>,
  error: object
) => expect(promise).rejects.toMatchObject({ error })

describe('createWeight', () => {
  it('saves an Entry', async () => {
    const entry = { date: today, grams: 72_500 }

    expect(await create(entry)).toEqual(entry)
    expect(await all()).toEqual([entry])
  })

  it('replaces the same day', async () => {
    await create({ date: today, grams: 72_500 })
    await create({ date: today, grams: 71_900 })

    expect(await all()).toEqual([
      { date: today, grams: 71_900 }
    ])
  })

  it('rejects a future date', async () => {
    await failsWith(
      create({ date: '2026-06-16', grams: 70_000 }),
      { code: 'future-date' }
    )
    expect(await all()).toEqual([])
  })

  it.each([
    ['date', { date: '2026-6-15', grams: 1 }],
    ['date', { date: '2026-02-30', grams: 1 }],
    ['date', { grams: 1 }],
    ['grams', { date: today, grams: 70.5 }],
    ['grams', { date: today, grams: 0 }],
    ['grams', { date: today, grams: -1 }],
    ['grams', { date: today, grams: 1_000_001 }],
    ['grams', { date: today, grams: '70000' }],
    ['', { date: today, grams: 1, kg: 1 }],
    ['', null]
  ])('rejects an invalid %s: %j', (field, value) =>
    failsWith(create(value), {
      code: 'invalid-payload',
      field
    }))
})

describe('listWeight', () => {
  it('lists the range, both ends included', async () => {
    for (const date of [
      '2026-05-31',
      '2026-06-03',
      '2026-06-01',
      '2026-06-10',
      '2026-06-11'
    ]) await create({ date, grams: 70_000 })

    const listed = await listWeight(db, {
      from: '2026-06-01',
      to: '2026-06-10'
    })

    expect(listed.map(entry => entry.date)).toEqual([
      '2026-06-01',
      '2026-06-03',
      '2026-06-10'
    ])
  })

  it('rejects a range ending before it starts', () =>
    failsWith(
      listWeight(db, {
        from: '2026-06-02',
        to: '2026-06-01'
      }),
      { code: 'invalid-payload', field: 'to' }
    ))
})

describe('updateWeight', () => {
  it("changes the day's grams", async () => {
    await create({ date: today, grams: 72_500 })

    const entry = { date: today, grams: 72_000 }

    expect(await updateWeight(db, entry, now))
      .toEqual(entry)
    expect(await all()).toEqual([entry])
  })

  it('rejects a day without an Entry', () =>
    failsWith(
      updateWeight(db, { date: today, grams: 1 }, now),
      { code: 'not-found' }
    ))

  it('rejects a future date', () =>
    failsWith(
      updateWeight(
        db,
        { date: '2027-01-01', grams: 1 },
        now
      ),
      { code: 'future-date' }
    ))
})

describe('deleteWeight', () => {
  it("deletes the day's Entry", async () => {
    await create({ date: today, grams: 72_500 })

    expect(await deleteWeight(db, today)).toBeNull()
    expect(await all()).toEqual([])
  })

  it('rejects a day without an Entry', () =>
    failsWith(deleteWeight(db, today), {
      code: 'not-found'
    }))

  it('rejects an invalid date', () =>
    failsWith(deleteWeight(db, 20260615), {
      code: 'invalid-payload'
    }))
})
