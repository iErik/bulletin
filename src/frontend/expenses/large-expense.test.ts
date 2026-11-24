import { describe, expect, it } from 'vitest'
import type { Budget } from '@shared/expenses'
import {
  isLargeExpense,
  LARGE_EXPENSE_SHARE,
  largeExpenses
} from './large-expense'

const budget = (
  amount: number,
  month = '2026-11'
): Budget => ({ month, amount })

const tx = (
  id: number,
  amount: number
): { id: number; amount: number } => ({ id, amount })

describe('isLargeExpense', () => {
  it('uses a 25% Budget share', () => {
    expect(LARGE_EXPENSE_SHARE).toBe(0.25)
  })

  it('matches at the exact 25% boundary in centavos', () => {
    const plan = budget(2_400_000)

    expect(isLargeExpense({ amount: -600_000 }, plan))
      .toBe(true)
    expect(isLargeExpense({ amount: -599_999 }, plan))
      .toBe(false)
    expect(isLargeExpense({ amount: -1_299_300 }, plan))
      .toBe(true)
  })

  it('handles Budgets not divisible by four', () => {
    const plan = budget(10)

    expect(isLargeExpense({ amount: -2 }, plan)).toBe(false)
    expect(isLargeExpense({ amount: -3 }, plan)).toBe(true)
  })

  it('returns false when there is no Budget', () => {
    expect(isLargeExpense({ amount: -1_000_000 }, null))
      .toBe(false)
  })

  it('never marks Income or zero Transactions as Large', () => {
    const plan = budget(2_400_000)

    expect(isLargeExpense({ amount: 600_000 }, plan))
      .toBe(false)
    expect(isLargeExpense({ amount: 0 }, plan)).toBe(false)
  })

  it('marks every Expense Large when the Budget is 0', () => {
    const zero = budget(0)

    expect(isLargeExpense({ amount: -1 }, zero)).toBe(true)
    expect(isLargeExpense({ amount: 0 }, zero)).toBe(false)
    expect(isLargeExpense({ amount: 100 }, zero)).toBe(false)
  })

  it('accepts an earlier month\'s fallback Budget', () => {
    const earlier = budget(2_400_000, '2026-08')

    expect(isLargeExpense({ amount: -600_000 }, earlier))
      .toBe(true)
  })
})

describe('largeExpenses', () => {
  it('returns matching Expenses in input order', () => {
    const list = [
      tx(1, 2_500_000),
      tx(2, -600_000),
      tx(3, -599_999),
      tx(4, 0),
      tx(5, -1_299_300)
    ]

    expect(largeExpenses(list, budget(2_400_000)))
      .toEqual([list[1], list[4]])
  })

  it('returns an empty list without a Budget', () => {
    const list = [tx(1, -1_000_000), tx(2, -500_000)]

    expect(largeExpenses(list, null)).toEqual([])
  })

  it('leaves the input array untouched', () => {
    const list = [tx(1, -600_000), tx(2, -100)]

    largeExpenses(list, budget(2_400_000))

    expect(list).toHaveLength(2)
  })
})
