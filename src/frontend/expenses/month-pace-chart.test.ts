import { afterEach, describe, expect, it } from 'vitest'
import type { Budget, Transaction } from '@shared/expenses'
import { setLocaleOverride } from '@/locale/format'
import { monthPace } from './month-pace'
import {
  dayBars,
  dayFraction,
  dayLabels,
  formatAxisMoney,
  largeExpenseLabel,
  yScale
} from './month-pace-chart'

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

const budget = (amount: number): Budget =>
  ({ month: '2026-11', amount })

const nov = (day: number): Date => new Date(2026, 10, day)

describe('yScale', () => {
  it('uses steps of 6k for a 24,000 Budget', () => {
    const pace = monthPace(
      [
        tx('2026-11-05', -379_500),
        tx('2026-11-12', -1_299_300, 'MPB M5')
      ],
      budget(2_400_000),
      nov(21)
    )

    expect(yScale(pace)).toEqual({
      top: 2_400_000,
      ticks: [0, 600_000, 1_200_000, 1_800_000, 2_400_000]
    })
  })

  it('rounds the projection up to an even step', () => {
    // Projects to 18,414, past a 16,000 Budget: steps
    // of 5k.
    const pace = monthPace(
      [
        tx('2026-11-05', -379_500),
        tx('2026-11-12', -1_299_300)
      ],
      budget(1_600_000),
      nov(21)
    )

    expect(yScale(pace).top).toBe(2_000_000)
  })

  it('steps in halves of a power of ten', () => {
    // 13,500 spent on the last day: steps of 3.5k.
    const pace = monthPace(
      [tx('2026-11-30', -1_350_000)],
      null,
      nov(30)
    )

    expect(yScale(pace).ticks)
      .toEqual([0, 350_000, 700_000, 1_050_000, 1_400_000])
  })

  it('keeps an exact step as it is', () => {
    const pace = monthPace([], budget(400_000), nov(3))

    expect(yScale(pace).top).toBe(400_000)
  })

  it('takes the spend when it passes the Budget', () => {
    const pace = monthPace(
      [tx('2026-11-30', -3_000_000)],
      budget(2_400_000),
      nov(30)
    )

    expect(yScale(pace).top).toBe(3_000_000)
  })

  it('never steps below R$ 1', () => {
    const pace = monthPace(
      [tx('2026-11-30', -37)],
      null,
      nov(30)
    )

    expect(yScale(pace).ticks)
      .toEqual([0, 100, 200, 300, 400])
  })

  it('tops out at R$ 1k with nothing to show', () => {
    const pace = monthPace([], null, nov(10))

    expect(yScale(pace).ticks)
      .toEqual([0, 25_000, 50_000, 75_000, 100_000])
  })
})

describe('formatAxisMoney', () => {
  afterEach(() => setLocaleOverride(null))

  it('writes thousands compactly, as in Figma', () => {
    setLocaleOverride('pt-BR')

    expect([0, 600_000, 1_200_000, 2_400_000]
      .map(formatAxisMoney))
      .toEqual(['0', '6k', '12k', '24k'])
  })

  it('uses the Locale for decimals', () => {
    setLocaleOverride('pt-BR')
    expect(formatAxisMoney(150_000)).toBe('1,5k')

    setLocaleOverride('en-US')
    expect(formatAxisMoney(150_000)).toBe('1.5k')
    expect(formatAxisMoney(105_000)).toBe('1.05k')
  })

  it('writes plain reais below 1,000', () => {
    setLocaleOverride('en-US')

    expect(formatAxisMoney(25_000)).toBe('250')
    expect(formatAxisMoney(150)).toBe('1.5')
  })
})

describe('dayFraction', () => {
  it('runs from the 1st to the last day', () => {
    expect(dayFraction(1, 30)).toBe(0)
    expect(dayFraction(30, 30)).toBe(1)
    expect(dayFraction(12, 30)).toBeCloseTo(11 / 29, 10)
  })
})

describe('dayLabels', () => {
  it('labels the 1st and every fifth day', () => {
    expect(dayLabels(30)).toEqual([1, 5, 10, 15, 20, 25, 30])
    expect(dayLabels(31)).toEqual([1, 5, 10, 15, 20, 25, 30])
    expect(dayLabels(28)).toEqual([1, 5, 10, 15, 20, 25])
  })
})

describe('dayBars', () => {
  it('stops bars at the cap, which is full height', () => {
    // 2,500 over 10 days: average 250, so bright from
    // 500 and capped above 1,000.
    const spends = [100, 400, 100, 100, 100, 100, 100, 100,
      100, 1_300]
    const pace = monthPace(
      spends.map((amount, i) =>
        tx(`2026-11-${String(i + 1).padStart(2, '0')}`,
          -amount)),
      null,
      nov(10)
    )
    const bars = dayBars(pace)

    expect(pace.averagePerDay).toBe(250)
    expect(bars[0]).toEqual({
      day: 1,
      rest: false,
      height: 0.1,
      bright: false,
      capped: false
    })
    expect(bars[1]).toMatchObject({
      height: 0.4,
      bright: false
    })
    expect(bars[9]).toMatchObject({
      height: 1,
      bright: true,
      capped: true
    })
  })

  it('marks days left as rests', () => {
    const pace = monthPace(
      [tx('2026-11-01', -10_000)],
      null,
      nov(21)
    )
    const bars = dayBars(pace)

    expect(bars).toHaveLength(30)
    expect(bars[20].rest).toBe(false)
    expect(bars[21]).toEqual({
      day: 22,
      rest: true,
      height: 0,
      bright: false,
      capped: false
    })
  })

  it('fills the most spent without a cap', () => {
    // Every Expense is Large, so the average is 0.
    const pace = monthPace(
      [
        tx('2026-11-02', -1_000_000),
        tx('2026-11-04', -500_000)
      ],
      budget(1_000_000),
      nov(5)
    )
    const bars = dayBars(pace)

    expect(pace.cap).toBeNull()
    expect(bars.slice(0, 5).map(b => b.height))
      .toEqual([0, 1, 0, 0.5, 0])
    expect(bars.some(b => b.capped)).toBe(false)
  })

  it('leaves every bar flat with no spend', () => {
    const pace = monthPace([], null, nov(3))

    expect(dayBars(pace).map(b => b.height))
      .toEqual(Array(30).fill(0))
  })
})

describe('largeExpenseLabel', () => {
  it('names a lone Large Expense', () => {
    expect(largeExpenseLabel([tx('2026-11-12', -1, 'MPB M5')]))
      .toBe('MPB M5')
  })

  it('names the largest and counts the others', () => {
    expect(largeExpenseLabel([
      tx('2026-11-12', -700_000, 'Sofa'),
      tx('2026-11-12', -1_299_300, 'MPB M5'),
      tx('2026-11-13', -650_000, 'Rent')
    ])).toBe('MPB M5 +2')
  })

  it('is null with none', () => {
    expect(largeExpenseLabel([])).toBeNull()
  })
})
