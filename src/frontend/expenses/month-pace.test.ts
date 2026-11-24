import { describe, expect, it } from 'vitest'
import type { Budget, Transaction } from '@shared/expenses'
import { monthPace } from './month-pace'

let nextId = 1

const tx = (
  date: string,
  amount: number,
  description = 'Item'
): Transaction => ({
  id: nextId++,
  date,
  description,
  categoryId: 1,
  amount
})

const budget = (
  amount: number,
  month = '2026-11'
): Budget => ({ month, amount })

describe('monthPace', () => {
  it('projects the brief example (16,788 / 12,993 / 9 left)', () => {
    const laptop = tx('2026-11-10', -1_299_300, 'Laptop')
    const regular = tx('2026-11-05', -379_500, 'Groceries')

    const result = monthPace(
      [regular, laptop],
      budget(2_400_000),
      new Date(2026, 10, 21)
    )

    expect(result.spent).toBe(1_678_800)
    expect(result.largeExpenses).toEqual([laptop])
    expect(result.daysLeft).toBe(9)
    expect(result.averagePerDay).toBeCloseTo(379_500 / 21, 10)
    expect(result.projection)
      .toBeCloseTo(1_678_800 + (379_500 / 21) * 9, 10)
    expect(Math.round(result.projection / 100)).toBe(18_414)
    expect(result.cap).toBeCloseTo(4 * (379_500 / 21), 10)
    expect(result.pace).toEqual({
      start: { day: 1, date: '2026-11-01', amount: 0 },
      end: {
        day: 30,
        date: '2026-11-30',
        amount: 2_400_000
      }
    })
  })

  it('tracks running totals on elapsed days only', () => {
    const result = monthPace(
      [
        tx('2026-11-01', -10_000),
        tx('2026-11-01', -5_000),
        tx('2026-11-03', -20_000)
      ],
      budget(2_400_000),
      new Date(2026, 10, 3)
    )

    expect(result.days).toHaveLength(30)
    expect(result.days.slice(0, 4).map(d => [
      d.day, d.date, d.elapsed, d.spend, d.total
    ])).toEqual([
      [1, '2026-11-01', true, 15_000, 15_000],
      [2, '2026-11-02', true, 0, 15_000],
      [3, '2026-11-03', true, 20_000, 35_000],
      [4, '2026-11-04', false, 0, null]
    ])
  })

  it('applies the 6,000 vs 5,999.99 Large Expense boundary', () => {
    const atQuarter = tx('2026-11-02', -600_000, 'Rent')
    const justUnder = tx('2026-11-03', -599_999, 'Sofa')

    const result = monthPace(
      [atQuarter, justUnder],
      budget(2_400_000),
      new Date(2026, 10, 10)
    )

    expect(result.largeExpenses).toEqual([atQuarter])
    expect(result.days[1].largeExpenses).toEqual([atQuarter])
    expect(result.days[2].largeExpenses).toEqual([])
    expect(result.averagePerDay).toBe(599_999 / 10)
  })

  it('sorts Large Expenses largest first overall and per day', () => {
    const small = tx('2026-11-04', -600_000, 'Bike')
    const big = tx('2026-11-04', -1_200_000, 'Laptop')
    const mid = tx('2026-11-02', -900_000, 'Phone')

    const result = monthPace(
      [small, big, mid],
      budget(2_400_000),
      new Date(2026, 10, 10)
    )

    expect(result.largeExpenses).toEqual([big, mid, small])
    expect(result.days[3].largeExpenses).toEqual([big, small])
    expect(result.days[1].largeExpenses).toEqual([mid])
  })

  it('has no Large Expenses and no pace line without a Budget', () => {
    const huge = tx('2026-11-02', -1_500_000, 'Laptop')
    const result = monthPace(
      [huge],
      null,
      new Date(2026, 10, 10)
    )

    expect(result.largeExpenses).toEqual([])
    expect(result.days[1].largeExpenses).toEqual([])
    expect(result.pace).toBeNull()
    expect(result.averagePerDay).toBe(150_000)
    expect(result.projection).toBe(1_500_000 + 150_000 * 20)
  })

  it('ignores Income and zero-amount Transactions', () => {
    const expense = tx('2026-11-02', -10_000, 'Lunch')
    const day = new Date(2026, 10, 5)
    const plan = budget(2_400_000)

    const withExtras = monthPace(
      [
        expense,
        tx('2026-11-02', 500_000, 'Salary'),
        tx('2026-11-03', 0, 'Adjustment')
      ],
      plan,
      day
    )
    expect(withExtras).toEqual(monthPace([expense], plan, day))
  })

  it('marks days at 2x bright and days above 4x capped', () => {
    // 10 elapsed days, regular spend = 100_000 ->
    // average = 10_000, bright >= 20_000, cap = 40_000.
    const boundary = monthPace(
      [
        tx('2026-11-01', -19_999),
        tx('2026-11-02', -20_000),
        tx('2026-11-03', -40_000),
        tx('2026-11-04', -20_001)
      ],
      budget(2_400_000),
      new Date(2026, 10, 10)
    )
    expect(boundary.cap).toBe(40_000)
    expect(boundary.days.slice(0, 3).map(d => [
      d.bright, d.capped
    ])).toEqual([
      [false, false],
      [true, false],
      [true, false]
    ])

    const overCap = monthPace(
      [
        tx('2026-11-01', -40_001),
        tx('2026-11-02', -59_999)
      ],
      budget(2_400_000),
      new Date(2026, 10, 10)
    )
    expect(overCap.cap).toBe(40_000)
    expect(overCap.days.slice(0, 2).map(d => [
      d.bright, d.capped
    ])).toEqual([[true, true], [true, true]])
  })

  it('has no days left and projects equal to spend on last day', () => {
    const result = monthPace(
      [tx('2026-11-05', -12_345)],
      budget(100_000),
      new Date(2026, 10, 30)
    )

    expect(result.daysLeft).toBe(0)
    expect(result.projection).toBe(12_345)
    expect(result.days.every(d => d.elapsed && d.total !== null))
      .toBe(true)
  })

  it('ignores Transactions outside the month or after the day', () => {
    const result = monthPace(
      [
        tx('2026-09-30', -50_000, 'Earlier month'),
        tx('2026-10-01', -10_000, 'Day 1'),
        tx('2026-10-15', -20_000, 'Selected Date'),
        tx('2026-10-16', -900_000, 'Later in month'),
        tx('2026-11-01', -900_000, 'Next month')
      ],
      budget(2_400_000, '2026-10'),
      new Date(2026, 9, 15, 18, 30)
    )

    expect(result.days).toHaveLength(31)
    expect(result.spent).toBe(30_000)
    expect(result.largeExpenses).toEqual([])
    expect(result.daysLeft).toBe(16)
    expect(result.days[14].total).toBe(30_000)
    expect(result.days[15]).toEqual({
      day: 16,
      date: '2026-10-16',
      elapsed: false,
      spend: 0,
      total: null,
      largeExpenses: [],
      bright: false,
      capped: false
    })
  })

  it('gives zeros everywhere and no cap with no Expenses', () => {
    const result = monthPace(
      [],
      budget(2_400_000),
      new Date(2026, 10, 12)
    )

    expect(result.spent).toBe(0)
    expect(result.largeExpenses).toEqual([])
    expect(result.averagePerDay).toBe(0)
    expect(result.daysLeft).toBe(18)
    expect(result.projection).toBe(0)
    expect(result.cap).toBeNull()
    expect(result.pace?.end.amount).toBe(2_400_000)
    expect(result.days.every(d => !d.bright && !d.capped))
      .toBe(true)
    expect(result.days.slice(0, 12).every(d => d.total === 0))
      .toBe(true)
    expect(result.days.slice(12).every(d => d.total === null))
      .toBe(true)
  })

  it('treats every Expense as Large when the Budget is 0', () => {
    const coffee = tx('2026-11-02', -1_500, 'Coffee')
    const result = monthPace(
      [coffee],
      budget(0),
      new Date(2026, 10, 5)
    )

    expect(result.spent).toBe(1_500)
    expect(result.largeExpenses).toEqual([coffee])
    expect(result.averagePerDay).toBe(0)
    expect(result.projection).toBe(1_500)
    expect(result.cap).toBeNull()
    expect(result.pace).toEqual({
      start: { day: 1, date: '2026-11-01', amount: 0 },
      end: { day: 30, date: '2026-11-30', amount: 0 }
    })
    expect(result.days.slice(0, 3).map(d => [
      d.bright, d.capped
    ])).toEqual([
      [false, false],
      [true, false],
      [false, false]
    ])
  })

  it('checks Large Expense per Transaction, not per day', () => {
    const result = monthPace(
      [
        tx('2026-11-04', -400_000, 'Flight out'),
        tx('2026-11-04', -400_000, 'Flight back')
      ],
      budget(2_400_000),
      new Date(2026, 10, 10)
    )

    expect(result.largeExpenses).toEqual([])
    expect(result.days[3].spend).toBe(800_000)
    expect(result.days[3].largeExpenses).toEqual([])
    expect(result.averagePerDay).toBe(80_000)
  })

  it('requires positive spend for bright when average is 0', () => {
    const laptop = tx('2026-11-03', -1_200_000, 'Laptop')
    const result = monthPace(
      [laptop],
      budget(2_400_000),
      new Date(2026, 10, 5)
    )

    expect(result.averagePerDay).toBe(0)
    expect(result.cap).toBeNull()
    expect(result.projection).toBe(1_200_000)
    expect(result.days[0].bright).toBe(false)
    expect(result.days[2].bright).toBe(true)
    expect(result.days[2].capped).toBe(false)
  })

  it('keeps unrounded centavos and handles leap February', () => {
    const result = monthPace(
      [tx('2024-02-01', -100)],
      budget(100_000, '2024-01'),
      new Date(2024, 1, 3)
    )

    expect(result.days).toHaveLength(29)
    expect(result.daysLeft).toBe(26)
    expect(result.averagePerDay).toBe(100 / 3)
    expect(result.projection).toBe(100 + (100 / 3) * 26)
    expect(result.cap).toBe(4 * (100 / 3))
    expect(result.pace?.end.date).toBe('2024-02-29')
  })
})
