import { describe, expect, it } from 'vitest'
import { useFixedToday } from '@/testing/clock'
import {
  budgetProgress,
  formatAmount,
  totals
} from './money'

const amounts = (
  ...values: number[]
): { amount: number }[] =>
  values.map(amount => ({ amount }))

describe('totals', () => {
  it('sums Income and the absolute Expenses', () => {
    expect(totals(amounts(2_500_000, -3_000, -10_245)))
      .toEqual({ income: 2_500_000, expenses: 13_245 })
  })

  it('counts zero as neither', () => {
    expect(totals(amounts(0, 0)))
      .toEqual({ income: 0, expenses: 0 })
  })

  it('is zero for no Transactions', () => {
    expect(totals([])).toEqual({ income: 0, expenses: 0 })
  })
})

describe('budgetProgress', () => {
  it.each([
    [0, 10_000, 0, false],
    [2_500, 10_000, 0.25, false],
    [10_000, 10_000, 1, false],
    [15_000, 10_000, 1.5, true],
    [0, 0, 0, false],
    [100, 0, Infinity, true]
  ])(
    'compares %i of Expenses with a %i Budget',
    (expenses, budget, ratio, over) => {
      expect(budgetProgress(expenses, budget))
        .toEqual({ ratio, over })
    }
  )
})

describe('formatAmount', () => {
  useFixedToday()

  // Intl separates some parts with no-break spaces.
  const plain = (text: string): string =>
    text.replace(/[  ]/g, ' ')

  it('writes centavos as reais in en-US', () => {
    expect(formatAmount(2_500_000)).toBe('R$25,000.00')
    expect(formatAmount(-3_000)).toBe('-R$30.00')
  })

  it('writes centavos as reais in pt-BR', async () => {
    const { setLocaleOverride } =
      await import('@/locale/format')
    setLocaleOverride('pt-BR')

    expect(plain(formatAmount(2_500_000)))
      .toBe('R$ 25.000,00')
    expect(plain(formatAmount(-3_000)))
      .toBe('-R$ 30,00')
  })
})
