import { beforeEach, describe, expect, it } from 'vitest'
import { MOODS } from '@shared/mood'
import type { Database } from './database'
import {
  createMood,
  deleteMood,
  listMood,
  updateMood
} from './mood'
import { memoryDatabase } from './testing'

// Noon on 15 June 2026, local time.
const now = new Date(2026, 5, 15, 12)
const today = '2026-06-15'

let db: Database
beforeEach(() => {
  db = memoryDatabase()
})

const create = (value: unknown) =>
  createMood(db, value, now)
const all = () =>
  listMood(db, { from: '2000-01-01', to: today })
const failsWith = (
  promise: Promise<unknown>,
  error: object
) => expect(promise).rejects.toMatchObject({ error })

describe('MOODS', () => {
  it('has unique keys and colour tokens', () => {
    const keys = new Set(MOODS.map(mood => mood.key))
    const colours = new Set(MOODS.map(mood => mood.colour))

    expect(keys.size).toBe(MOODS.length)
    expect(colours.size).toBe(MOODS.length)
  })
})

describe('createMood', () => {
  it.each(MOODS.map(mood => mood.key))(
    'saves the Mood %s',
    async mood => {
      const entry = { date: today, mood }

      expect(await create(entry)).toEqual(entry)
      expect(await all()).toEqual([entry])
    }
  )

  it('replaces the same day', async () => {
    await create({ date: today, mood: 'happy' })
    await create({ date: today, mood: 'angry' })

    expect(await all()).toEqual([
      { date: today, mood: 'angry' }
    ])
  })

  it('rejects a future date', async () => {
    await failsWith(
      create({ date: '2026-06-16', mood: 'happy' }),
      { code: 'future-date' }
    )
    expect(await all()).toEqual([])
  })

  it.each([
    ['mood', { date: today, mood: 'ecstatic' }],
    ['mood', { date: today, mood: 'Happy' }],
    ['mood', { date: today, mood: '' }],
    ['mood', { date: today }],
    ['date', { date: '2026-02-30', mood: 'okay' }],
    ['', { date: today, mood: 'okay', colour: 'x' }],
    ['', null]
  ])('rejects an invalid %s: %j', (field, value) =>
    failsWith(create(value), {
      code: 'invalid-payload',
      field
    }))
})

describe('listMood', () => {
  it('lists the range, both ends included', async () => {
    for (const date of [
      '2026-05-31',
      '2026-06-03',
      '2026-06-01',
      '2026-06-10',
      '2026-06-11'
    ]) await create({ date, mood: 'neutral' })

    const listed = await listMood(db, {
      from: '2026-06-01',
      to: '2026-06-10'
    })

    expect(listed.map(entry => entry.date)).toEqual([
      '2026-06-01',
      '2026-06-03',
      '2026-06-10'
    ])
  })

  it('rejects an invalid range', () =>
    failsWith(listMood(db, { from: today }), {
      code: 'invalid-payload',
      field: 'to'
    }))
})

describe('updateMood', () => {
  it("changes the day's Mood", async () => {
    await create({ date: today, mood: 'happy' })
    const entry = { date: today, mood: 'anxious' }

    expect(await updateMood(db, entry, now))
      .toEqual(entry)
    expect(await all()).toEqual([entry])
  })

  it('rejects a day without an Entry', () =>
    failsWith(
      updateMood(db, { date: today, mood: 'okay' }, now),
      { code: 'not-found' }
    ))

  it('rejects an invalid key', async () => {
    await create({ date: today, mood: 'happy' })

    await failsWith(
      updateMood(db, { date: today, mood: 'x' }, now),
      { code: 'invalid-payload', field: 'mood' }
    )
  })
})

describe('deleteMood', () => {
  it("clears the day's Mood", async () => {
    await create({ date: today, mood: 'stressed' })

    expect(await deleteMood(db, today)).toBeNull()
    expect(await all()).toEqual([])
  })

  it('rejects a day without an Entry', () =>
    failsWith(deleteMood(db, today), {
      code: 'not-found'
    }))
})

describe('the mood table', () => {
  it('keeps one Entry per day, never undated', () => {
    const insert = db.$client.prepare(
      'INSERT INTO mood (date, mood) VALUES (?, ?)'
    )
    insert.run(today, 'happy')

    expect(() => insert.run(today, 'okay'))
      .toThrow(/UNIQUE constraint failed/)
    expect(() => insert.run(null, 'okay'))
      .toThrow(/CHECK constraint failed/)
  })
})
