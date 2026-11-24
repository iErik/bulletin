/**
 * Pure calculations for the Insights Widget: five fixed
 * rows of month-to-date findings about spend. Each row's
 * function returns its figure, or `null` when the row is
 * hidden.
 *
 * The period runs from the 1st of the Selected Date's
 * month through the Selected Date. Spend means Expenses
 * only: Income and zero amounts never count. Money is in
 * centavos. Averages per day count every elapsed day,
 * with days without spend as 0.
 */
import {
  addDays,
  getDate,
  getDay,
  startOfMonth
} from 'date-fns'
import { localDate } from '@shared/dates'
import type {
  Budget,
  Category,
  Transaction
} from '@shared/expenses'
import type { MoodEntry } from '@shared/mood'
import type { LocalDate } from '@shared/storage'
import { formatNumber, locale } from '@/locale/format'
import { largeExpenses } from './large-expense'
import { formatAmount } from './money'

/** One Category's spend in the period and comparison. */
export interface CategorySpend {
  readonly category: Category
  /** Spend in the period, in centavos. */
  readonly spend: number
  /** Spend in the comparison period, in centavos. */
  readonly comparison: number
}

/** Row 1: the Category whose spend changed most. */
export interface CategoryChange {
  readonly category: Category
  /** Signed whole % change against the comparison. */
  readonly percent: number
}

/** Row 4: the period's spend without Large Expenses. */
export interface WithoutLarge {
  /** The largest Large Expense, which names the row. */
  readonly largest: Transaction
  /** How many other Large Expenses there are. */
  readonly others: number
  /** Whole % of the Budget the rest of the spend used. */
  readonly percent: number
}

/** A visible row, in the Widget's fixed order. */
export type InsightRow =
  | { readonly kind: 'category'; readonly value: CategoryChange }
  | { readonly kind: 'weekends'; readonly value: number }
  | { readonly kind: 'savings'; readonly value: number }
  | { readonly kind: 'without'; readonly value: WithoutLarge }
  | { readonly kind: 'stressed'; readonly value: number }

/** What the rows are computed from. */
export interface InsightInputs {
  /** Per-Category spend, as By Category computes it. */
  readonly categories: readonly CategorySpend[]
  /** Transactions covering at least the period. */
  readonly transactions: readonly Transaction[]
  /** The Budget that applies to the month, if any. */
  readonly budget: Budget | null
  /** Mood Entries covering at least the period. */
  readonly moods: readonly MoodEntry[]
  /** The Selected Date. */
  readonly day: Date
}

/** A percentage rounded half away from zero. */
const wholePercent = (fraction: number): number =>
  (Math.sign(fraction) * Math.round(Math.abs(fraction) * 100))
  || 0

/** The period's days, from the 1st to `day`. */
const elapsedDays = (day: Date): Date[] => {
  const first = startOfMonth(day)
  return Array.from(
    { length: getDate(day) },
    (_, i) => addDays(first, i)
  )
}

const inPeriod = (
  transactions: readonly Transaction[],
  day: Date
): Transaction[] => {
  const from = localDate(startOfMonth(day))
  const to = localDate(day)
  return transactions.filter(({ date }) =>
    date >= from && date <= to)
}

/** The period's Expenses, in the order given. */
export const periodExpenses = (
  transactions: readonly Transaction[],
  day: Date
): Transaction[] =>
  inPeriod(transactions, day)
    .filter(({ amount }) => amount < 0)

/** Spend per day of the period, in centavos. */
const spendByDay = (
  transactions: readonly Transaction[],
  day: Date
): Map<LocalDate, number> => {
  const byDay = new Map<LocalDate, number>()
  for (const date of elapsedDays(day))
    byDay.set(localDate(date), 0)
  for (const { date, amount } of periodExpenses(
    transactions, day
  ))
    byDay.set(date, (byDay.get(date) ?? 0) - amount)
  return byDay
}

const sumSpend = (
  expenses: readonly Pick<Transaction, 'amount'>[]
): number =>
  expenses.reduce((sum, { amount }) => sum - amount, 0)

const average = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0)
  / values.length

/**
 * Row 1: the Category whose spend changed most in
 * absolute amount. Categories without comparison spend
 * are skipped; ties go to the larger period spend, then
 * the name.
 */
export const categoryChange = (
  rows: readonly CategorySpend[]
): CategoryChange | null => {
  const change = (row: CategorySpend): number =>
    Math.abs(row.spend - row.comparison)
  const [top] = rows
    .filter(row => row.comparison > 0)
    .sort((a, b) =>
      change(b) - change(a)
      || b.spend - a.spend
      || a.category.name.localeCompare(
        b.category.name, locale()
      ))
  return top
    ? {
        category: top.category,
        percent: wholePercent(
          (top.spend - top.comparison) / top.comparison
        )
      }
    : null
}

/**
 * Row 2: average spend per elapsed Saturday or Sunday
 * over average spend per elapsed weekday, unrounded.
 * Hidden without both kinds of day, or with no spend on
 * either, as neither ratio could be written.
 */
export const weekendRatio = (
  transactions: readonly Transaction[],
  day: Date
): number | null => {
  const weekend: number[] = []
  const weekdays: number[] = []
  const byDay = spendByDay(transactions, day)
  for (const date of elapsedDays(day)) {
    const spend = byDay.get(localDate(date)) ?? 0
    const weekday = getDay(date)
    if (weekday === 0 || weekday === 6) weekend.push(spend)
    else weekdays.push(spend)
  }
  if (!weekend.length || !weekdays.length) return null
  const ratio = average(weekend) / average(weekdays)
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null
}

/**
 * Row 3: (Income − spend) ÷ Income in the period, as a
 * signed whole %. Hidden without Income.
 */
export const savingsRate = (
  transactions: readonly Transaction[],
  day: Date
): number | null => {
  let income = 0
  let spend = 0
  for (const { amount } of inPeriod(transactions, day)) {
    if (amount > 0) income += amount
    else spend -= amount
  }
  return income > 0
    ? wholePercent((income - spend) / income)
    : null
}

/**
 * Row 4: (spend − Large Expenses) ÷ Budget, as a whole
 * %. Hidden without a Large Expense, so also without a
 * Budget, and with a zero Budget, which can't divide.
 */
export const withoutLarge = (
  transactions: readonly Transaction[],
  budget: Budget | null,
  day: Date
): WithoutLarge | null => {
  if (budget === null || budget.amount <= 0) return null
  const expenses = periodExpenses(transactions, day)
  const [largest, ...others] = largeExpenses(expenses, budget)
    .sort((a, b) => a.amount - b.amount)
  if (!largest) return null
  const spend = sumSpend(expenses)
  const rest = spend - sumSpend([largest, ...others])
  return {
    largest,
    others: others.length,
    percent: wholePercent(rest / budget.amount)
  }
}

/**
 * Row 5: average spend on elapsed Stressed days minus
 * average spend on elapsed days with another Mood, in
 * centavos, unrounded. Days without a Mood are in
 * neither group. Hidden when either group is empty.
 */
export const stressedExtra = (
  transactions: readonly Transaction[],
  moods: readonly MoodEntry[],
  day: Date
): number | null => {
  const byDay = spendByDay(transactions, day)
  const stressed: number[] = []
  const other: number[] = []
  for (const { date, mood } of moods) {
    const spend = byDay.get(date)
    if (spend === undefined) continue
    if (mood === 'stressed') stressed.push(spend)
    else other.push(spend)
  }
  return stressed.length && other.length
    ? average(stressed) - average(other)
    : null
}

const row = <K extends InsightRow['kind']>(
  kind: K,
  value: Extract<InsightRow, { kind: K }>['value'] | null
): InsightRow | null =>
  value === null ? null : ({ kind, value } as InsightRow)

/** The visible rows, in the Widget's fixed order. */
export const insightRows = (
  inputs: InsightInputs
): InsightRow[] => {
  const { transactions, budget, moods, day } = inputs
  const rows: (InsightRow | null)[] = [
    row('category', categoryChange(inputs.categories)),
    row('weekends', weekendRatio(transactions, day)),
    row('savings', savingsRate(transactions, day)),
    row('without', withoutLarge(transactions, budget, day)),
    row('stressed', stressedExtra(transactions, moods, day))
  ]
  return rows.filter(item => item !== null)
}

const oneDecimal = (value: number): string =>
  formatNumber(value, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })

/**
 * Row 2's value: "N× more" above 1, "N× less" below,
 * with N the inverse ratio, and "same" when N rounds to
 * 1.0. N has one decimal, in the Locale.
 */
export const ratioText = (ratio: number): string => {
  const more = ratio >= 1
  const shown = more ? ratio : 1 / ratio
  if (Math.round(shown * 10) === 10) return 'same'
  return `${oneDecimal(shown)}× ${more ? 'more' : 'less'}`
}

/** Row 5's value: "+R$ X" or "−R$ X", with cents. */
export const extraText = (centavos: number): string => {
  const rounded = Math.round(centavos)
  return `${rounded < 0 ? '−' : '+'}${
    formatAmount(Math.abs(rounded))
  }`
}
