/**
 * The Expenses table's rows, kept pure: their order
 * and how each amount is coloured.
 */
import type { Transaction } from '@shared/expenses'

/**
 * Oldest first. Ties keep the order they were added
 * in, which ids follow.
 */
export const orderRows = <
  T extends Pick<Transaction, 'date' | 'id'>
>(transactions: readonly T[]): T[] =>
  [...transactions].sort((a, b) =>
    a.date === b.date
      ? a.id - b.id
      : a.date < b.date ? -1 : 1)

/** What an amount is, by its sign (see `CONTEXT.md`). */
export type Tone = 'income' | 'expense' | 'zero'

export const amountTone = (centavos: number): Tone => {
  if (centavos > 0) return 'income'
  return centavos < 0 ? 'expense' : 'zero'
}
