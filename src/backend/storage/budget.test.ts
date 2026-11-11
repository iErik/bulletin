import { beforeEach, describe, expect, it } from 'vitest'
import { getBudget, setBudget } from './budget'
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

describe('getBudget', () => {
  it('returns null with no Budgets', async () => {
    expect(await getBudget(db, '2026-06')).toBeNull()
  })

  it('returns the month\'s own Budget', async () => {
    await setBudget(db, { month: '2026-05', amount: 100 })
    await setBudget(db, { month: '2026-06', amount: 200 })

    expect(await getBudget(db, '2026-06'))
      .toEqual({ month: '2026-06', amount: 200 })
  })

  it('carries forward the most recent earlier Budget',
    async () => {
      await setBudget(db, { month: '2025-11', amount: 1 })
      await setBudget(db, { month: '2026-02', amount: 2 })
      await setBudget(db, { month: '2026-09', amount: 3 })

      expect(await getBudget(db, '2026-06'))
        .toEqual({ month: '2026-02', amount: 2 })
      expect(await getBudget(db, '2026-01'))
        .toEqual({ month: '2025-11', amount: 1 })
    })

  it('returns null before the first Budget', async () => {
    await setBudget(db, { month: '2026-06', amount: 1 })

    expect(await getBudget(db, '2026-05')).toBeNull()
  })

  it.each(['2026-13', '2026-00', '2026-6', '2026-06-01',
    6])('rejects the month %j', month =>
    failsWith(getBudget(db, month), {
      code: 'invalid-payload',
      field: ''
    }))
})

describe('setBudget', () => {
  it('replaces the month\'s Budget', async () => {
    await setBudget(db, { month: '2026-06', amount: 100 })

    expect(await setBudget(db, {
      month: '2026-06',
      amount: 0
    })).toEqual({ month: '2026-06', amount: 0 })
    expect(await getBudget(db, '2026-06'))
      .toEqual({ month: '2026-06', amount: 0 })
  })

  it('allows a future month', async () => {
    const budget = { month: '2999-01', amount: 500 }

    expect(await setBudget(db, budget)).toEqual(budget)
  })

  it.each([
    [{ month: '2026-13', amount: 1 }, 'month'],
    [{ amount: 1 }, 'month'],
    [{ month: '2026-06', amount: -1 }, 'amount'],
    [{ month: '2026-06', amount: 1.5 }, 'amount'],
    [{ month: '2026-06' }, 'amount'],
    [{ month: '2026-06', amount: 1, x: 1 }, '']
  ])('rejects %j', (budget, field) =>
    failsWith(setBudget(db, budget), {
      code: 'invalid-payload',
      field
    }))
})

describe('the budget table', () => {
  it('keeps one per month, dated, not negative', () => {
    const insert = db.$client.prepare(
      'INSERT INTO budget (month, amount) VALUES (?, ?)'
    )
    insert.run('2026-06', 100)

    expect(() => insert.run('2026-06', 200))
      .toThrow(/UNIQUE constraint failed/)
    expect(() => insert.run(null, 200))
      .toThrow(/CHECK constraint failed/)
    expect(() => insert.run('2026-07', -1))
      .toThrow(/CHECK constraint failed/)
  })
})
