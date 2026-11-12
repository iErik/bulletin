/**
 * The Expenses Widget's sums, kept pure. Amounts are
 * signed centavos: positive is Income, negative an
 * Expense (see `CONTEXT.md`).
 */
import type { Transaction } from '@shared/expenses'
import { formatMoney } from '@/locale/format'

export interface Totals {
  /** The sum of the positive amounts. */
  readonly income: number
  /** The absolute sum of the negative amounts. */
  readonly expenses: number
}

export const totals = (
  transactions: readonly Pick<Transaction, 'amount'>[]
): Totals => {
  let income = 0
  let expenses = 0
  for (const { amount } of transactions) {
    if (amount > 0) income += amount
    else expenses -= amount
  }
  return { income, expenses }
}

export interface BudgetProgress {
  /**
   * Expenses ÷ Budget, uncapped: 1 is the whole
   * Budget. Infinite when a zero Budget has Expenses.
   */
  readonly ratio: number
  /** Whether the Expenses exceed the Budget. */
  readonly over: boolean
}

export const budgetProgress = (
  expenses: number,
  budget: number
): BudgetProgress => ({
  ratio: budget > 0
    ? expenses / budget
    : expenses > 0 ? Infinity : 0,
  over: expenses > budget
})

/** An amount in centavos, as Locale money in BRL. */
export const formatAmount = (centavos: number): string =>
  formatMoney(centavos / 100)
