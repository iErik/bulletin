/**
 * The Month Pace Widget's geometry, without rendering:
 * the running-total chart's y axis and its compact
 * labels, where each day sits across both charts, the
 * Daily spend bars and the Large Expense label text.
 * Money values are in centavos, as `monthPace` gives
 * them.
 */
import type { Transaction } from '@shared/expenses'
import { formatNumber } from '@/locale/format'
import type { MonthPace } from './month-pace'

/** The y axis is split into this many equal steps. */
export const Y_INTERVALS = 4

/** The smallest step, R$ 1, so labels stay whole. */
const MIN_STEP = 100

/** The step with nothing to show: R$ 250, up to 1k. */
const EMPTY_STEP = 25_000

/** Float noise allowed when rounding a step up. */
const EPSILON = 1e-9

export interface YScale {
  /** The axis's top value, in centavos. */
  readonly top: number
  /** Every tick from 0 up to `top`, in centavos. */
  readonly ticks: readonly number[]
}

/**
 * `raw` rounded up to a multiple of half its power of
 * ten: 1, 1.5, 2 … 9.5, 10 × 10ⁿ.
 */
const niceStep = (raw: number): number => {
  const unit = 10 ** Math.floor(Math.log10(raw)) / 2
  return Math.ceil(raw / unit - EPSILON) * unit
}

/**
 * The y axis: from 0 to the largest of the Budget, the
 * projection and the spend, rounded up to an even step,
 * in four intervals. 24,000 gives steps of 6,000.
 */
export const yScale = (pace: MonthPace): YScale => {
  const max = Math.max(
    pace.pace?.end.amount ?? 0,
    pace.projection,
    pace.spent
  )
  const step = max > 0
    ? Math.max(niceStep(max / Y_INTERVALS), MIN_STEP)
    : EMPTY_STEP
  return {
    top: step * Y_INTERVALS,
    ticks: Array.from(
      { length: Y_INTERVALS + 1 },
      (_, i) => i * step
    )
  }
}

/**
 * A y-axis label, written compactly as Figma does:
 * "6k" from R$ 1,000 up, plain reais below, in the
 * Locale's digits ("1,5k" in pt-BR).
 */
export const formatAxisMoney = (centavos: number): string => {
  const reais = centavos / 100
  if (reais < 1000)
    return formatNumber(reais, { maximumFractionDigits: 1 })
  const thousands = formatNumber(reais / 1000, {
    maximumFractionDigits: 2
  })
  return `${thousands}k`
}

/**
 * Where `day` (1 to `days`) sits across the plot, from
 * 0 (the 1st, at the left edge) to 1 (the last day, at
 * the right edge). Both charts share it.
 */
export const dayFraction = (
  day: number,
  days: number
): number => (days > 1 ? (day - 1) / (days - 1) : 0)

/** The days labelled under the bars: 1, 5, 10, … */
export const dayLabels = (days: number): number[] => [
  1,
  ...Array.from(
    { length: Math.floor(days / 5) },
    (_, i) => (i + 1) * 5
  )
]

/** One day's bar in the Daily spend chart. */
export interface DayBar {
  readonly day: number
  /** A day left: a flat placeholder dash, no bar. */
  readonly rest: boolean
  /** Height from 0 to 1, where 1 is the cap. */
  readonly height: number
  readonly bright: boolean
  /** Stopped at the cap, so it gets an `↑` mark. */
  readonly capped: boolean
}

/**
 * The Daily spend bars. Bars stop at the cap (4× the
 * average per day), which is full height. Without a
 * cap, the day with the most spend is full height.
 */
export const dayBars = (pace: MonthPace): DayBar[] => {
  const full = pace.cap
    ?? Math.max(0, ...pace.days.map(d => d.spend))
  return pace.days.map(d => ({
    day: d.day,
    rest: !d.elapsed,
    height: full > 0 ? Math.min(d.spend / full, 1) : 0,
    bright: d.bright,
    capped: d.capped
  }))
}

/**
 * Names Large Expenses by the largest one, adding
 * "+N" for the others: "MPB M5", "MPB M5 +2". `null`
 * when there are none. The Month Pace labels and
 * caption and the Insights Widget share it.
 */
export const largeExpenseLabel = (
  expenses: readonly Pick<
    Transaction, 'amount' | 'description'
  >[]
): string | null => {
  if (expenses.length === 0) return null
  // Expenses are negative: the largest is the lowest.
  const largest = expenses.reduce((a, b) =>
    b.amount < a.amount ? b : a
  )
  const others = expenses.length - 1
  return others > 0
    ? `${largest.description} +${others}`
    : largest.description
}
