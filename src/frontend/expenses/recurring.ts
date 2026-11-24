/**
 * The Recurring Expense rule (see `CONTEXT.md`) and the
 * Recurring Widget's text, kept pure. An Expense recurs
 * when its description, trimmed and ignoring case,
 * appears in each of the last three consecutive months,
 * up to the Selected Date. Monthly only, for now.
 *
 * Amounts are in centavos, positive for an Expense.
 */
import {
  addMonths,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth
} from 'date-fns'
import { localDate } from '@shared/dates'
import type { Transaction } from '@shared/expenses'
import type { LocalDate } from '@shared/storage'
import { formatDate } from '@/locale/format'
import { formatAmount } from './money'

/** How many consecutive months make an Expense recur. */
export const RECURRING_MONTHS = 3
/** Due dates up to this many days ahead count down. */
export const SOON_DAYS = 7

/** One Recurring Expense, from its latest occurrence. */
export interface RecurringExpense {
  /** As written in the latest occurrence, trimmed. */
  readonly description: string
  /** The latest occurrence's amount, in centavos. */
  readonly amount: number
  /** The latest occurrence's date. */
  readonly latest: LocalDate
  /**
   * The same day a month after `latest`, capped at that
   * month's last day.
   */
  readonly nextDue: LocalDate
  /**
   * Days from the Selected Date to `nextDue`: 0 on the
   * day, negative once it's past.
   */
  readonly daysUntilDue: number
}

/** Every Recurring Expense, and their monthly total. */
export interface Recurring {
  /** By amount, largest first, then by description. */
  readonly expenses: readonly RecurringExpense[]
  /** The sum of `expenses`' amounts, in centavos. */
  readonly monthly: number
  /**
   * `monthly` ÷ the Selected Date month's Income so
   * far, as a whole %; `null` without Income.
   */
  readonly incomeShare: number | null
}

/** `YYYY-MM-DD` as a local Date. */
const toDate = (date: LocalDate): Date => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const monthKey = (date: Date): string =>
  format(date, 'yyyy-MM')

/** The later of two occurrences: by date, then id. */
const later = (a: Transaction, b: Transaction): Transaction =>
  b.date > a.date || (b.date === a.date && b.id > a.id)
    ? b
    : a

/**
 * Whether occurrences in `months` (`YYYY-MM`) recur as
 * of `selected`'s month: the three months must end with
 * it if it has one, otherwise with the month before.
 */
const recurs = (
  months: ReadonlySet<string>,
  selected: Date
): boolean => {
  const first = startOfMonth(selected)
  const end = months.has(monthKey(first))
    ? first
    : addMonths(first, -1)
  return Array.from(
    { length: RECURRING_MONTHS },
    (_, i) => monthKey(addMonths(end, -i))
  ).every(month => months.has(month))
}

/**
 * The Recurring Expenses as of `day` (the Selected
 * Date). Only Expenses up to `day` count; Income only
 * for the share, from the 1st of `day`'s month.
 */
export const recurringExpenses = (
  transactions: readonly Transaction[],
  day: Date
): Recurring => {
  const today = localDate(day)
  const monthStart = localDate(startOfMonth(day))

  const groups = new Map<string, {
    latest: Transaction
    months: Set<string>
  }>()
  let income = 0

  for (const transaction of transactions) {
    const { amount, date } = transaction
    if (date > today) continue
    if (amount > 0) {
      if (date >= monthStart) income += amount
      continue
    }
    if (amount === 0) continue

    const key = transaction.description.trim().toLowerCase()
    // A blank description names nothing to recur.
    if (!key) continue

    const group = groups.get(key)
    if (group) {
      group.latest = later(group.latest, transaction)
      group.months.add(date.slice(0, 7))
    } else {
      groups.set(key, {
        latest: transaction,
        months: new Set([date.slice(0, 7)])
      })
    }
  }

  const expenses: RecurringExpense[] = []
  for (const { latest, months } of groups.values()) {
    if (!recurs(months, day)) continue
    const nextDue = addMonths(toDate(latest.date), 1)
    expenses.push({
      description: latest.description.trim(),
      amount: -latest.amount,
      latest: latest.date,
      nextDue: localDate(nextDue),
      daysUntilDue: differenceInCalendarDays(
        nextDue,
        startOfDay(day)
      )
    })
  }

  expenses.sort((a, b) =>
    b.amount - a.amount
    || a.description.localeCompare(b.description))

  const monthly = expenses
    .reduce((sum, { amount }) => sum + amount, 0)

  return {
    expenses,
    monthly,
    incomeShare: income > 0
      ? Math.round((monthly / income) * 100)
      : null
  }
}

/** "next today", "next in 3 days", "next Dec 8" or "due Nov 3". */
const dueText = (
  { nextDue, daysUntilDue }: RecurringExpense
): string => {
  if (daysUntilDue < 0)
    return `due ${formatDate(toDate(nextDue), 'short')}`
  if (daysUntilDue === 0) return 'next today'
  if (daysUntilDue === 1) return 'next in 1 day'
  if (daysUntilDue <= SOON_DAYS)
    return `next in ${daysUntilDue} days`
  return `next ${formatDate(toDate(nextDue), 'short')}`
}

/**
 * A row's line under its description, such as
 * "Monthly · 8th · next Dec 8".
 */
export const recurringCaption = (
  expense: RecurringExpense
): string =>
  [
    'Monthly',
    formatDate(toDate(expense.latest), 'ordinal'),
    dueText(expense)
  ].join(' · ')

/**
 * The footer, such as "R$ 2.477,35 / month fixed · 10%
 * of income"; without Income, the share is left out.
 */
export const recurringFooter = (
  { monthly, incomeShare }: Recurring
): string => {
  const fixed = `${formatAmount(monthly)} / month fixed`
  return incomeShare === null
    ? fixed
    : `${fixed} · ${incomeShare}% of income`
}
