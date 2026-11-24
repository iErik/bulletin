/**
 * The By Category Widget's rows, kept pure: each
 * Category's spend in the period against the
 * comparison period (see BLT-103's brief), with its
 * change and bar length.
 *
 * Money values are in centavos.
 */
import { startOfMonth } from 'date-fns'
import { localDate, sameSpanLastMonth } from '@shared/dates'
import type {
  Category,
  Transaction
} from '@shared/expenses'
import type { DateRange, LocalDate } from '@shared/storage'
import { locale } from '@/locale/format'

/** How a Category's spend moved since the comparison. */
export type CategoryChange =
  /** No spend in the comparison period. */
  | { readonly kind: 'new' }
  /**
   * A signed whole-number percentage: positive grew,
   * negative fell, 0 unchanged once rounded.
   */
  | { readonly kind: 'percent'; readonly percent: number }

/** One Category's row. */
export interface CategoryRow {
  readonly category: Category
  /** Spend in the period. */
  readonly spend: number
  /** Spend in the comparison period. */
  readonly comparison: number
  readonly change: CategoryChange
  /**
   * Bar length from 0 to 1, on a square-root scale
   * against the period's largest spend, which gets 1.
   */
  readonly bar: number
}

/** The period and the comparison period for `day`. */
export const spendPeriods = (day: Date): {
  readonly period: DateRange
  readonly comparison: DateRange
} => {
  const to = localDate(day)
  return {
    period: { from: localDate(startOfMonth(day)), to },
    comparison: sameSpanLastMonth(to)
  }
}

const within = (
  date: LocalDate,
  { from, to }: DateRange
): boolean => date >= from && date <= to

const change = (
  spend: number,
  comparison: number
): CategoryChange => {
  if (comparison === 0) return { kind: 'new' }
  const ratio = (spend - comparison) / comparison * 100
  // Rounds half away from zero, and never gives -0.
  const percent = Math.sign(ratio)
    * Math.round(Math.abs(ratio))
  return { kind: 'percent', percent: percent || 0 }
}

/**
 * Rows for every Category with spend in `day`'s period
 * or its comparison period, by spend in the period,
 * then in the comparison period, largest first, then
 * by name. Only Expenses count: Income, zero amounts
 * and Transactions outside both periods are ignored,
 * as are Categories missing from `categories`.
 */
export const categoryRows = (
  transactions: readonly Transaction[],
  categories: readonly Category[],
  day: Date
): CategoryRow[] => {
  const { period, comparison } = spendPeriods(day)
  const byId = new Map(categories.map(c => [c.id, c]))
  const sums = new Map<number, {
    spend: number
    comparison: number
  }>()

  for (const { amount, categoryId, date } of transactions) {
    if (amount >= 0 || !byId.has(categoryId)) continue
    const inPeriod = within(date, period)
    if (!inPeriod && !within(date, comparison)) continue
    const sum = sums.get(categoryId)
      ?? { spend: 0, comparison: 0 }
    if (inPeriod) sum.spend -= amount
    else sum.comparison -= amount
    sums.set(categoryId, sum)
  }

  let top = 0
  for (const { spend } of sums.values())
    top = Math.max(top, spend)

  return [...sums]
    .map(([id, sum]): CategoryRow => ({
      category: byId.get(id) as Category,
      spend: sum.spend,
      comparison: sum.comparison,
      change: change(sum.spend, sum.comparison),
      bar: top > 0 ? Math.sqrt(sum.spend / top) : 0
    }))
    .sort((a, b) =>
      b.spend - a.spend
      || b.comparison - a.comparison
      || a.category.name.localeCompare(
        b.category.name,
        locale()
      ))
}
