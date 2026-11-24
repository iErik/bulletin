/**
 * Pure calculations for the Month Pace Widget: daily spend,
 * running totals, Large Expenses, daily average, month-end
 * projection, Budget pace endpoints and the bar cap.
 *
 * Money values are in centavos; `averagePerDay`,
 * `projection` and `cap` stay unrounded for formatting.
 */
import {
  addDays,
  getDate,
  getDaysInMonth,
  startOfMonth
} from 'date-fns'
import { localDate } from '@shared/dates'
import type { Budget, Transaction } from '@shared/expenses'
import type { LocalDate } from '@shared/storage'
import { isLargeExpense } from './large-expense'

/** Days at or above this multiple of average are bright. */
export const BRIGHT_MULTIPLIER = 2
/** Bars cap at this multiple of the daily average. */
export const CAP_MULTIPLIER = 4

/** One day in the Month Pace calculation. */
export interface MonthPaceDay {
  /** Day of the month, 1 through the month's length. */
  readonly day: number
  readonly date: LocalDate
  readonly elapsed: boolean
  /** This day's Expenses, in centavos (0 after `day`). */
  readonly spend: number
  /** Running total in centavos, or `null` after `day`. */
  readonly total: number | null
  /** This day's Large Expenses, largest first. */
  readonly largeExpenses: readonly Transaction[]
  /** Positive spend at least 2× the daily average. */
  readonly bright: boolean
  /** Spend strictly above the 4× bar cap. */
  readonly capped: boolean
}

/** One endpoint of the Budget's even-pace line. */
export interface PaceEndpoint {
  readonly day: number
  readonly date: LocalDate
  /** In centavos. */
  readonly amount: number
}

/** The Budget pace line from 0 on the 1st to the Budget. */
export interface BudgetPace {
  readonly start: PaceEndpoint
  readonly end: PaceEndpoint
}

/** Month Pace figures for the Selected Date's month. */
export interface MonthPace {
  /** Every day of the month, from the 1st to the last. */
  readonly days: readonly MonthPaceDay[]
  /** Total Expenses through the Selected Date, in centavos. */
  readonly spent: number
  /** Elapsed Large Expenses, largest first. */
  readonly largeExpenses: readonly Transaction[]
  /** `(spent − Large Expenses) ÷ elapsed`, unrounded. */
  readonly averagePerDay: number
  /** Days after the Selected Date until month end. */
  readonly daysLeft: number
  /** `spent + averagePerDay × daysLeft`, unrounded. */
  readonly projection: number
  /** Budget pace endpoints, or `null` without a Budget. */
  readonly pace: BudgetPace | null
  /** `4 × averagePerDay` unrounded, or `null` when avg is 0. */
  readonly cap: number | null
}

/**
 * The pace line's amount on day `day` of the month, in
 * centavos, unrounded: a straight line between the two
 * endpoints, so 0 on the 1st and the Budget on the last
 * day.
 */
export const paceOn = (
  pace: BudgetPace,
  day: number
): number => {
  const { start, end } = pace
  if (end.day === start.day) return end.amount
  return start.amount
    + (end.amount - start.amount)
    * (day - start.day) / (end.day - start.day)
}

interface DayBucket {
  spend: number
  largeExpenses: Transaction[]
}

const byLargestExpense = (
  a: Transaction,
  b: Transaction
): number => a.amount - b.amount

/**
 * Computes Month Pace for `day`'s month as it stood on
 * `day` (the Selected Date). Only Expenses from the 1st
 * through `day` count; Income, zero amounts, and
 * Transactions outside that range are ignored.
 */
export const monthPace = (
  transactions: readonly Transaction[],
  budget: Budget | null,
  day: Date
): MonthPace => {
  const first = startOfMonth(day)
  const totalDays = getDaysInMonth(first)
  const elapsedDays = getDate(day)
  const daysLeft = totalDays - elapsedDays

  const dates = Array.from(
    { length: totalDays },
    (_, i) => localDate(addDays(first, i))
  )

  const buckets = new Map<LocalDate, DayBucket>()
  for (let i = 0; i < elapsedDays; i++)
    buckets.set(dates[i], { spend: 0, largeExpenses: [] })

  const allLarge: Transaction[] = []
  let spent = 0
  let largeTotal = 0

  for (const transaction of transactions) {
    if (transaction.amount >= 0) continue
    const bucket = buckets.get(transaction.date)
    if (!bucket) continue

    const amount = -transaction.amount
    bucket.spend += amount
    spent += amount

    if (isLargeExpense(transaction, budget)) {
      bucket.largeExpenses.push(transaction)
      allLarge.push(transaction)
      largeTotal += amount
    }
  }

  const averagePerDay = (spent - largeTotal) / elapsedDays
  const projection = spent + averagePerDay * daysLeft
  const cap = averagePerDay > 0
    ? CAP_MULTIPLIER * averagePerDay
    : null

  let running = 0
  const days: MonthPaceDay[] = dates.map((date, i) => {
    const bucket = buckets.get(date)
    if (!bucket) {
      return {
        day: i + 1,
        date,
        elapsed: false,
        spend: 0,
        total: null,
        largeExpenses: [],
        bright: false,
        capped: false
      }
    }

    const { spend } = bucket
    running += spend
    return {
      day: i + 1,
      date,
      elapsed: true,
      spend,
      total: running,
      largeExpenses: [...bucket.largeExpenses]
        .sort(byLargestExpense),
      bright: spend > 0
        && spend >= BRIGHT_MULTIPLIER * averagePerDay,
      capped: cap !== null && spend > cap
    }
  })

  const pace: BudgetPace | null = budget === null
    ? null
    : {
        start: { day: 1, date: dates[0], amount: 0 },
        end: {
          day: totalDays,
          date: dates[totalDays - 1],
          amount: budget.amount
        }
      }

  return {
    days,
    spent,
    largeExpenses: allLarge.sort(byLargestExpense),
    averagePerDay,
    daysLeft,
    projection,
    pace,
    cap
  }
}
