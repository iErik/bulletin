/**
 * The shared Large Expense rule (see `CONTEXT.md`): an
 * Expense of at least a quarter of its month's Budget.
 * A month with no Budget has none.
 */
import type { Budget, Transaction } from '@shared/expenses'

/** Share of a month's Budget that makes an Expense Large. */
export const LARGE_EXPENSE_SHARE = 0.25

/**
 * Whether `transaction` is a Large Expense under `budget`.
 * Pass the `Budget | null` returned by `getBudget`, so the
 * fallback to an earlier month's Budget applies.
 */
export const isLargeExpense = (
  transaction: Pick<Transaction, 'amount'>,
  budget: Pick<Budget, 'amount'> | null
): boolean =>
  budget !== null
  && transaction.amount < 0
  && -transaction.amount
    >= LARGE_EXPENSE_SHARE * budget.amount

/**
 * Every Large Expense in `transactions`, in the order
 * given. Returns none when `budget` is `null`.
 */
export const largeExpenses = <
  T extends Pick<Transaction, 'amount'>
>(
  transactions: readonly T[],
  budget: Pick<Budget, 'amount'> | null
): T[] =>
  budget === null
    ? []
    : transactions.filter(transaction =>
        isLargeExpense(transaction, budget)
      )
