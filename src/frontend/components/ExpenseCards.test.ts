import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { Budget, Transaction } from '@shared/expenses'
import { useFixedToday } from '@/testing/clock'
import ExpenseCards from './ExpenseCards.vue'

const NOVEMBER = new Date(2026, 10, 1)

const transaction = (
  id: number,
  amount: number
): Transaction => ({
  id,
  date: '2026-11-03',
  description: `Transaction ${id}`,
  categoryId: 1,
  amount
})

const TRANSACTIONS = [
  transaction(1, 2_500_000),
  transaction(2, -3_000),
  transaction(3, -10_245),
  transaction(4, 0)
]

const mountCards = (
  budget: Budget | null,
  transactions = TRANSACTIONS
): VueWrapper =>
  mount(ExpenseCards, {
    props: { transactions, budget, month: NOVEMBER }
  })

const value = (
  wrapper: VueWrapper,
  card: string
): string =>
  wrapper.get(`.card.-${card} .value`).text()

describe('ExpenseCards', () => {
  useFixedToday()

  it('shows the month’s Income and absolute Expenses', () => {
    const wrapper = mountCards(null)

    expect(value(wrapper, 'income')).toBe('R$25,000.00')
    expect(value(wrapper, 'expenses')).toBe('R$132.45')
  })

  it('shows the month’s own Budget unmarked', () => {
    const wrapper = mountCards(
      { month: '2026-11', amount: 300_000 }
    )

    expect(value(wrapper, 'budget')).toBe('R$3,000.00')
    expect(wrapper.find('.from').exists()).toBe(false)
  })

  it('marks a carried-forward Budget with its month', () => {
    const wrapper = mountCards(
      { month: '2026-08', amount: 300_000 }
    )

    expect(wrapper.get('.from').text())
      .toBe('from August')
  })

  it('names the year of a Budget from another year', () => {
    const wrapper = mountCards(
      { month: '2025-12', amount: 300_000 }
    )

    expect(wrapper.get('.from').text())
      .toBe('from December 2025')
  })

  it('fills the bar with Expenses ÷ Budget', () => {
    const bar = mountCards(
      { month: '2026-11', amount: 52_980 }
    ).get('.bar')

    expect(bar.attributes('aria-valuenow')).toBe('25')
    expect(bar.get<HTMLElement>('.fill').element
      .style.width).toBe('25%')
    expect(bar.classes()).not.toContain('-over')
  })

  it('caps the bar and turns it red past the Budget', () => {
    const bar = mountCards(
      { month: '2026-11', amount: 10_000 }
    ).get('.bar')

    expect(bar.attributes('aria-valuenow')).toBe('100')
    expect(bar.classes()).toContain('-over')
  })

  it('shows a dash and no bar without a Budget', () => {
    const wrapper = mountCards(null)

    expect(value(wrapper, 'budget')).toBe('—')
    expect(wrapper.find('.bar').exists()).toBe(false)
    expect(wrapper.find('.from').exists()).toBe(false)
  })
})
