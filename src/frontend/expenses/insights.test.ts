import { describe, expect, it } from 'vitest'
import type {
  Budget,
  Category,
  Transaction
} from '@shared/expenses'
import type { MoodEntry, MoodKey } from '@shared/mood'
import { setLocaleOverride } from '@/locale/format'
import { useFixedToday } from '@/testing/clock'
import {
  type CategorySpend,
  categoryChange,
  extraText,
  insightRows,
  periodExpenses,
  ratioText,
  savingsRate,
  stressedExtra,
  weekendRatio,
  withoutLarge
} from './insights'

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

const mood = (date: string, key: MoodKey): MoodEntry =>
  ({ date, mood: key })

const category = (id: number, name: string): Category =>
  ({ id, name })

const spend = (
  name: string,
  current: number,
  comparison: number,
  id = nextId++
): CategorySpend => ({
  category: category(id, name),
  spend: current,
  comparison
})

// November 2026 starts on a Sunday.
const NOV_7 = new Date(2026, 10, 7)
const NOV_21 = new Date(2026, 10, 21)

describe('periodExpenses', () => {
  it('keeps Expenses from the 1st to the Selected Date', () => {
    const inside = tx('2026-11-07', -100)
    expect(periodExpenses([
      tx('2026-10-31', -100),
      inside,
      tx('2026-11-08', -100),
      tx('2026-11-03', 500),
      tx('2026-11-03', 0)
    ], NOV_7)).toEqual([inside])
  })
})

describe('categoryChange', () => {
  it('shows Food ↑32% for R$ 840 against R$ 636', () => {
    const food = spend('Food', 84_000, 63_600)
    expect(categoryChange([
      spend('Cats', 20_500, 21_800),
      food,
      spend('Taxes', 228_200, 219_400)
    ])).toEqual({ category: food.category, percent: 32 })
  })

  it('writes a fall as a negative percent', () => {
    const fun = spend('Fun', 39_500, 48_200)
    expect(categoryChange([fun]))
      .toEqual({ category: fun.category, percent: -18 })
  })

  it('counts a Category with no spend now as −100%', () => {
    const gone = spend('Gone', 0, 10_000)
    expect(categoryChange([gone])?.percent).toBe(-100)
  })

  it('skips Categories with no comparison spend', () => {
    const food = spend('Food', 1_000, 900)
    expect(categoryChange([
      spend('Laptop', 1_299_300, 0),
      food
    ])?.category).toEqual(food.category)
  })

  it('is hidden when no Category qualifies', () => {
    expect(categoryChange([])).toBeNull()
    expect(categoryChange([spend('New', 5_000, 0)]))
      .toBeNull()
  })

  it('breaks ties on period spend, then the name', () => {
    const big = spend('Zoo', 20_000, 10_000)
    expect(categoryChange([
      spend('Ant', 0, 10_000),
      big
    ])?.category).toEqual(big.category)

    const ant = spend('Ant', 2_000, 1_000)
    expect(categoryChange([
      spend('Bee', 2_000, 1_000),
      ant
    ])?.category).toEqual(ant.category)
  })

  it('shows 0% when nothing changed', () => {
    expect(categoryChange([spend('Same', 500, 500)])
      ?.percent).toBe(0)
  })
})

describe('weekendRatio', () => {
  // Weekend: the 1st and 7th. Weekdays: the 2nd to 6th.
  const week = (
    weekend: number,
    weekday: number
  ): Transaction[] => [
    tx('2026-11-01', -weekend),
    tx('2026-11-07', -weekend),
    ...[2, 3, 4, 5, 6].map(day =>
      tx(`2026-11-0${day}`, -weekday))
  ]

  it('is 2.3 for R$ 230 against R$ 100 a day', () => {
    expect(weekendRatio(week(23_000, 10_000), NOV_7))
      .toBeCloseTo(2.3, 10)
  })

  it('counts days without spend as 0', () => {
    // Weekend 300 over 2 days, weekdays 500 over 5.
    expect(weekendRatio([
      tx('2026-11-07', -30_000),
      tx('2026-11-04', -50_000)
    ], NOV_7)).toBeCloseTo(15_000 / 10_000, 10)
  })

  it('ignores Income, zero and later days', () => {
    expect(weekendRatio([
      ...week(20_000, 10_000),
      tx('2026-11-02', 900_000),
      tx('2026-11-01', 0),
      tx('2026-11-08', -900_000)
    ], NOV_7)).toBeCloseTo(2, 10)
  })

  it('is hidden before a weekday has elapsed', () => {
    expect(weekendRatio([tx('2026-11-01', -100)],
      new Date(2026, 10, 1))).toBeNull()
  })

  it('is hidden before a weekend day has elapsed', () => {
    expect(weekendRatio([tx('2026-12-01', -100)],
      new Date(2026, 11, 4))).toBeNull()
  })

  it('is hidden with no weekday spend', () => {
    expect(weekendRatio([tx('2026-11-01', -100)], NOV_7))
      .toBeNull()
  })

  it('is hidden with no weekend spend', () => {
    expect(weekendRatio([tx('2026-11-02', -100)], NOV_7))
      .toBeNull()
  })
})

describe('savingsRate', () => {
  it('is 18% for Income 10,000 and spend 8,200', () => {
    expect(savingsRate([
      tx('2026-11-05', 1_000_000),
      tx('2026-11-06', -500_000),
      tx('2026-11-07', -320_000)
    ], NOV_21)).toBe(18)
  })

  it('goes negative when spend exceeds Income', () => {
    expect(savingsRate([
      tx('2026-11-05', 100_000),
      tx('2026-11-06', -125_000)
    ], NOV_21)).toBe(-25)
  })

  it('is hidden without Income in the period', () => {
    expect(savingsRate([
      tx('2026-10-05', 100_000),
      tx('2026-11-06', -1_000)
    ], NOV_21)).toBeNull()
  })
})

describe('withoutLarge', () => {
  it('uses 41% without a R$ 12,993 Large Expense', () => {
    const laptop = tx('2026-11-10', -1_299_300, 'MPB M5')
    expect(withoutLarge([
      ...[5, 6, 7, 8].map(day =>
        tx(`2026-11-0${day}`, -246_000)),
      laptop,
      tx('2026-11-06', 500_000)
    ], budget(2_400_000), NOV_21)).toEqual({
      largest: laptop,
      others: 0,
      percent: 41
    })
  })

  it('names the largest and counts the others', () => {
    const laptop = tx('2026-11-10', -1_299_300, 'Laptop')
    const phone = tx('2026-11-12', -700_000, 'Phone')
    const result = withoutLarge(
      [phone, laptop, tx('2026-11-05', -240_000)],
      budget(2_400_000),
      NOV_21
    )
    expect(result).toEqual({
      largest: laptop,
      others: 1,
      percent: 10
    })
  })

  it('is hidden without a Large Expense', () => {
    expect(withoutLarge([tx('2026-11-05', -1_000)],
      budget(2_400_000), NOV_21)).toBeNull()
  })

  it('ignores a Large Expense after the Selected Date', () => {
    expect(withoutLarge([tx('2026-11-22', -2_000_000)],
      budget(2_400_000), NOV_21)).toBeNull()
  })

  it('is hidden without a Budget, or with a zero one', () => {
    const items = [tx('2026-11-05', -2_000_000)]
    expect(withoutLarge(items, null, NOV_21)).toBeNull()
    expect(withoutLarge(items, budget(0), NOV_21))
      .toBeNull()
  })
})

describe('stressedExtra', () => {
  it('is +R$ 64 for R$ 264 against R$ 200 a day', () => {
    expect(stressedExtra(
      [
        tx('2026-11-02', -26_400),
        tx('2026-11-03', -20_000),
        tx('2026-11-04', -15_000),
        tx('2026-11-04', -5_000),
        tx('2026-11-05', -99_999)
      ],
      [
        mood('2026-11-02', 'stressed'),
        mood('2026-11-03', 'happy'),
        mood('2026-11-04', 'neutral')
      ],
      NOV_21
    )).toBe(6_400)
  })

  it('counts days without spend as 0', () => {
    expect(stressedExtra(
      [tx('2026-11-03', -10_000)],
      [
        mood('2026-11-02', 'stressed'),
        mood('2026-11-03', 'angry')
      ],
      NOV_21
    )).toBe(-10_000)
  })

  it('leaves out days outside the period', () => {
    expect(stressedExtra(
      [tx('2026-11-03', -10_000)],
      [
        mood('2026-10-30', 'stressed'),
        mood('2026-11-22', 'stressed'),
        mood('2026-11-03', 'okay')
      ],
      NOV_21
    )).toBeNull()
  })

  it('is hidden when either group is empty', () => {
    const items = [tx('2026-11-03', -10_000)]
    expect(stressedExtra(items,
      [mood('2026-11-03', 'stressed')], NOV_21)).toBeNull()
    expect(stressedExtra(items,
      [mood('2026-11-03', 'happy')], NOV_21)).toBeNull()
    expect(stressedExtra(items, [], NOV_21)).toBeNull()
  })
})

describe('insightRows', () => {
  const full = {
    categories: [spend('Food', 84_000, 63_600)],
    transactions: [
      tx('2026-11-01', 1_000_000),
      tx('2026-11-01', -23_000),
      tx('2026-11-07', -23_000),
      tx('2026-11-02', -10_000),
      tx('2026-11-03', -1_299_300, 'Laptop')
    ],
    budget: budget(2_400_000),
    moods: [
      mood('2026-11-02', 'stressed'),
      mood('2026-11-04', 'happy')
    ],
    day: NOV_7
  }

  it('lists every row in the fixed order', () => {
    expect(insightRows(full).map(row => row.kind)).toEqual(
      ['category', 'weekends', 'savings', 'without', 'stressed']
    )
  })

  it('drops hidden rows and keeps the others in order', () => {
    expect(insightRows({
      ...full,
      categories: [],
      budget: null,
      moods: []
    }).map(row => row.kind)).toEqual(['weekends', 'savings'])
  })

  it('is empty when every row is hidden', () => {
    expect(insightRows({
      categories: [],
      transactions: [],
      budget: null,
      moods: [],
      day: NOV_7
    })).toEqual([])
  })
})

describe('ratioText', () => {
  useFixedToday()

  it.each([
    [2.3, '2.3× more'],
    [2, '2.0× more'],
    [0.5, '2.0× less'],
    [0.8, '1.3× less'],
    [1, 'same'],
    [1.04, 'same'],
    [0.96, 'same']
  ])('writes %f as %s', (ratio, text) => {
    expect(ratioText(ratio)).toBe(text)
  })

  it('uses the Locale\'s decimal separator', () => {
    setLocaleOverride('pt-BR')
    expect(ratioText(2.3)).toBe('2,3× more')
  })
})

describe('extraText', () => {
  useFixedToday()

  it('signs the amount and keeps cents', () => {
    expect(extraText(6_400)).toBe('+R$64.00')
    expect(extraText(-6_400.4)).toBe('−R$64.00')
    expect(extraText(0)).toBe('+R$0.00')
  })
})
