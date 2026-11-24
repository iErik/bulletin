import { describe, expect, it } from 'vitest'
import type {
  Category,
  Transaction
} from '@shared/expenses'
import {
  categoryRows,
  spendPeriods,
  type CategoryRow
} from './by-category'

const FOOD: Category = { id: 1, name: 'Food' }
const TAXES: Category = { id: 2, name: 'Taxes' }
const CATS: Category = { id: 3, name: 'Cats' }
const GYM: Category = { id: 4, name: 'Gym' }
const CATEGORIES = [FOOD, TAXES, CATS, GYM]

let nextId = 1

const tx = (
  date: string,
  amount: number,
  category: Category = FOOD
): Transaction => ({
  id: nextId++,
  date,
  description: 'Item',
  categoryId: category.id,
  amount
})

/** Nov 20, 2026: compares Nov 1–20 with Oct 1–20. */
const NOV_20 = new Date(2026, 10, 20)

const rows = (
  transactions: Transaction[],
  day = NOV_20
): CategoryRow[] =>
  categoryRows(transactions, CATEGORIES, day)

describe('spendPeriods', () => {
  it('runs from the 1st to the Selected Date', () => {
    expect(spendPeriods(NOV_20)).toEqual({
      period: { from: '2026-11-01', to: '2026-11-20' },
      comparison: { from: '2026-10-01', to: '2026-10-20' }
    })
  })

  it('compares Mar 31 against Feb 1–28', () => {
    expect(spendPeriods(new Date(2027, 2, 31))).toEqual({
      period: { from: '2027-03-01', to: '2027-03-31' },
      comparison: { from: '2027-02-01', to: '2027-02-28' }
    })
  })

  it('compares January against last December', () => {
    expect(spendPeriods(new Date(2027, 0, 15)).comparison)
      .toEqual({ from: '2026-12-01', to: '2026-12-15' })
  })
})

describe('categoryRows', () => {
  it('shows Food R$ 840 against R$ 636 as +32%', () => {
    const [food] = rows([
      tx('2026-11-03', -84_000),
      tx('2026-10-03', -63_600)
    ])

    expect(food).toMatchObject({
      category: FOOD,
      spend: 84_000,
      comparison: 63_600,
      change: { kind: 'percent', percent: 32 }
    })
  })

  it('sums several Expenses per Category and period', () => {
    const [food] = rows([
      tx('2026-11-03', -50_000),
      tx('2026-11-04', -34_000),
      tx('2026-10-03', -60_000),
      tx('2026-10-09', -3_600)
    ])

    expect(food).toMatchObject({
      spend: 84_000,
      comparison: 63_600
    })
  })

  it('marks a Category without comparison spend new', () => {
    const [food] = rows([tx('2026-11-03', -84_000)])

    expect(food.change).toEqual({ kind: 'new' })
  })

  it('keeps a Category spent on only last month', () => {
    const result = rows([
      tx('2026-11-03', -84_000),
      tx('2026-10-03', -20_500, CATS)
    ])

    expect(result[1]).toEqual({
      category: CATS,
      spend: 0,
      comparison: 20_500,
      change: { kind: 'percent', percent: -100 },
      bar: 0
    })
  })

  it('gives a falling Category a negative change', () => {
    const [food] = rows([
      tx('2026-11-03', -39_500),
      tx('2026-10-03', -48_200)
    ])

    expect(food.change)
      .toEqual({ kind: 'percent', percent: -18 })
  })

  it('shows unchanged spend as 0%', () => {
    const [food] = rows([
      tx('2026-11-03', -10_000),
      tx('2026-10-03', -10_000)
    ])

    expect(food.change)
      .toEqual({ kind: 'percent', percent: 0 })
  })

  it('rounds a tiny fall to 0, not -0', () => {
    const [food] = rows([
      tx('2026-11-03', -99_900),
      tx('2026-10-03', -100_000)
    ])

    const { change } = food
    expect(change.kind === 'percent'
      && Object.is(change.percent, 0)).toBe(true)
  })

  it('scales bars by the square root of spend', () => {
    const result = rows([
      tx('2026-11-03', -100_000, TAXES),
      tx('2026-11-03', -25_000, FOOD),
      tx('2026-11-03', -1_000, CATS)
    ])

    expect(result.map(row => row.bar))
      .toEqual([1, 0.5, 0.1])
  })

  it('matches Figma’s bar lengths', () => {
    const equipment = { id: 5, name: 'Equipment' }
    const result = categoryRows(
      [
        tx('2026-11-03', -1_299_300, equipment),
        tx('2026-11-03', -228_200, TAXES),
        tx('2026-11-03', -84_000, FOOD)
      ],
      [...CATEGORIES, equipment],
      NOV_20
    )

    expect(result.map(row => row.bar * 100))
      .toEqual([
        100,
        expect.closeTo(41.909, 3),
        expect.closeTo(25.426, 3)
      ])
  })

  it('sorts by spend, then comparison spend, then name', () => {
    const result = rows([
      tx('2026-11-03', -10_000, GYM),
      tx('2026-11-03', -50_000, FOOD),
      tx('2026-11-03', -10_000, TAXES),
      tx('2026-10-03', -30_000, TAXES),
      tx('2026-10-03', -40_000, CATS),
      tx('2026-11-03', -10_000, CATS)
    ])

    expect(result.map(row => row.category.name))
      .toEqual(['Food', 'Cats', 'Taxes', 'Gym'])
  })

  it('puts Categories spent on only last month last', () => {
    const result = rows([
      tx('2026-10-03', -90_000, TAXES),
      tx('2026-11-03', -1_000, FOOD),
      tx('2026-10-03', -20_000, CATS)
    ])

    expect(result.map(row => row.category.name))
      .toEqual(['Food', 'Taxes', 'Cats'])
  })

  it('ignores Income and zero amounts', () => {
    const result = rows([
      tx('2026-11-03', 500_000),
      tx('2026-11-03', 0, TAXES),
      tx('2026-10-03', 0, CATS),
      tx('2026-11-04', -84_000),
      tx('2026-10-04', 63_600)
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      category: FOOD,
      spend: 84_000,
      comparison: 0,
      change: { kind: 'new' }
    })
  })

  it('ignores Expenses outside both periods', () => {
    const result = rows([
      tx('2026-11-21', -10_000),
      tx('2026-10-21', -10_000),
      tx('2026-09-30', -10_000),
      tx('2026-11-20', -1_000),
      tx('2026-10-01', -2_000)
    ])

    expect(result).toEqual([expect.objectContaining({
      spend: 1_000,
      comparison: 2_000
    })])
  })

  it('compares Mar 31 against Feb 1–28 only', () => {
    const result = rows(
      [
        tx('2027-03-31', -10_000),
        tx('2027-02-28', -4_000),
        tx('2027-02-01', -1_000),
        tx('2027-01-31', -50_000)
      ],
      new Date(2027, 2, 31)
    )

    expect(result).toEqual([expect.objectContaining({
      spend: 10_000,
      comparison: 5_000,
      change: { kind: 'percent', percent: 100 }
    })])
  })

  it('has no rows without spend in either period', () => {
    expect(rows([tx('2026-11-03', 10_000)])).toEqual([])
  })

  it('skips Transactions of unknown Categories', () => {
    const lost = { id: 99, name: 'Lost' }

    expect(rows([tx('2026-11-03', -1_000, lost)]))
      .toEqual([])
  })
})
