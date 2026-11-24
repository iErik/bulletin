import { beforeEach, describe, expect, it } from 'vitest'
import { getSleepGoal, setSleepGoal } from './sleep-goal'
import type { Database } from './database'
import { memoryDatabase } from './testing'

let db: Database
beforeEach(() => {
  db = memoryDatabase()
})

const failsWith = (
  promise: Promise<unknown>,
  error: object
): Promise<void> =>
  expect(promise).rejects.toMatchObject({ error })

describe('getSleepGoal', () => {
  it('reads 8 hours when nothing is stored', async () => {
    expect(await getSleepGoal(db)).toBe(8 * 60)
  })
})

describe('setSleepGoal', () => {
  it('stores 7h 30m and reads it back', async () => {
    await setSleepGoal(db, 8 * 60)

    expect(await setSleepGoal(db, 7 * 60 + 30))
      .toBe(7 * 60 + 30)
    expect(await getSleepGoal(db)).toBe(7 * 60 + 30)
  })

  it.each([4 * 60, 12 * 60])(
    'accepts %s minutes',
    async minutes => {
      expect(await setSleepGoal(db, minutes)).toBe(minutes)
      expect(await getSleepGoal(db)).toBe(minutes)
    }
  )

  it.each([
    3 * 60,
    13 * 60,
    7 * 60 + 30.5,
    '450',
    null,
    undefined,
    Number.NaN,
    { minutes: 8 * 60 }
  ])('refuses %j', minutes =>
    failsWith(setSleepGoal(db, minutes), {
      code: 'invalid-payload',
      field: ''
    }))
})

describe('the sleep_goal table', () => {
  it('keeps one row, between 4h and 12h', () => {
    const insert = db.$client.prepare(
      'INSERT INTO sleep_goal (id, minutes) VALUES (?, ?)'
    )
    const clear = (): void => {
      db.$client.exec('DELETE FROM sleep_goal')
    }

    insert.run(1, 4 * 60)
    clear()
    insert.run(1, 12 * 60)
    clear()

    expect(() => insert.run(1, 3 * 60))
      .toThrow(/CHECK constraint failed/)
    expect(() => insert.run(1, 13 * 60))
      .toThrow(/CHECK constraint failed/)
    expect(() => insert.run(2, 8 * 60))
      .toThrow(/CHECK constraint failed/)
  })
})
