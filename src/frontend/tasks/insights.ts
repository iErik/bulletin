/**
 * Pure calculations and Locale-aware formatters for the
 * Task Insights Widget (BLT-128). Each row returns `null`
 * when hidden; Occurrences count like one-off Tasks.
 */
import {
  addDays,
  getDay,
  parseISO,
  startOfWeek
} from 'date-fns'
import { localDate } from '@shared/dates'
import type { Weekday } from '@shared/recurring-tasks'
import type { DateRange, LocalDate } from '@shared/storage'
import type { LocalTime, Task } from '@shared/tasks'
import {
  firstDayOfWeek,
  formatNumber,
  locale
} from '@/locale/format'

/** Fields shared by `Task` and `Occurrence` for Insights. */
export type InsightTask = Pick<
  Task,
  'day' | 'time' | 'doneAt' | 'moves'
>

export const PRODUCTIVE_WEEKS = 12
export const PRODUCTIVE_DAYS = PRODUCTIVE_WEEKS * 7
export const EVENING_DAYS = 90
export const EVENING_MIN_TASKS = 7
export const EVENING_CUTOFF: LocalTime = '20:00'
export const RESCHEDULED_MIN_MOVES = 3
export const AHEAD_WEEKS = 4

export interface CompletionStat {
  readonly planned: number
  readonly done: number
  readonly onTime: number
  /** Whole % (`done / planned`), rounded half away. */
  readonly percent: number
  /** Whole % (`onTime / planned`), rounded half away. */
  readonly onTimePercent: number
}

export interface ProductiveDay {
  readonly weekday: Weekday
  readonly done: number
  /** `done / 12`, unrounded. */
  readonly average: number
}

export interface EveningSlip {
  /** Evening slip share ÷ other timed slip share. */
  readonly ratio: number
  /** True when evening Tasks slip more (`ratio >= 1`). */
  readonly more: boolean
  readonly eveningSlipped: number
  readonly eveningTotal: number
  readonly otherSlipped: number
  readonly otherTotal: number
}

export interface BusiestWeek extends DateRange {
  readonly count: number
}

const shiftDay = (day: LocalDate, days: number): LocalDate =>
  localDate(addDays(parseISO(day), days))

const normalizeWeekStart = (weekStartsOn: number): Weekday =>
  (((weekStartsOn % 7) + 7) % 7) as Weekday

const doneDayOf = (doneAt: number): LocalDate =>
  localDate(new Date(doneAt))

const roundTenths = (value: number): number =>
  Math.round(Number((value * 10).toPrecision(12)))

const wholePercent = (fraction: number): number => {
  const scaled = Number(
    (Math.abs(fraction) * 100).toPrecision(12)
  )
  return Math.sign(fraction) * Math.round(scaled) || 0
}

const aheadWeeks = (
  date: LocalDate,
  weekStartsOn: number
): DateRange[] => {
  const weekStart = startOfWeek(parseISO(date), {
    weekStartsOn: normalizeWeekStart(weekStartsOn)
  })
  return Array.from({ length: AHEAD_WEEKS }, (_, i) => {
    const start = addDays(weekStart, 7 * (i + 1))
    return {
      from: localDate(start),
      to: localDate(addDays(start, 6))
    }
  })
}

/** Fetch span from 90 days back through 4 Locale weeks ahead. */
export const insightsRange = (
  date: LocalDate,
  weekStartsOn: number = firstDayOfWeek()
): DateRange => {
  const weeks = aheadWeeks(date, weekStartsOn)
  return {
    from: shiftDay(date, 1 - EVENING_DAYS),
    to: weeks[weeks.length - 1].to
  }
}

/**
 * Row 1 (Completion): done and on-time shares for Tasks
 * planned from the 1st of `date`'s month through `date`.
 */
export const completion = (
  items: readonly InsightTask[],
  date: LocalDate
): CompletionStat | null => {
  const from = `${date.slice(0, 7)}-01`
  let planned = 0
  let done = 0
  let onTime = 0
  for (const item of items) {
    if (item.day === null || item.day < from || item.day > date)
      continue
    planned += 1
    if (item.doneAt !== null) {
      done += 1
      if (doneDayOf(item.doneAt) <= item.day) onTime += 1
    }
  }
  if (planned === 0) return null
  return {
    planned,
    done,
    onTime,
    percent: wholePercent(done / planned),
    onTimePercent: wholePercent(onTime / planned)
  }
}

/**
 * Row 2 (Most productive day): weekday with highest average
 * Tasks done per day over 12 weeks ending on `date`, by
 * `doneAt`'s local calendar day. Ties favour earlier weekday.
 */
export const mostProductiveDay = (
  items: readonly InsightTask[],
  date: LocalDate,
  weekStartsOn: number = firstDayOfWeek()
): ProductiveDay | null => {
  const from = shiftDay(date, 1 - PRODUCTIVE_DAYS)
  const counts = new Array<number>(7).fill(0)
  for (const item of items) {
    if (item.doneAt === null) continue
    const doneDay = doneDayOf(item.doneAt)
    if (doneDay < from || doneDay > date) continue
    counts[getDay(parseISO(doneDay))] += 1
  }
  const start = normalizeWeekStart(weekStartsOn)
  let bestWeekday = start
  let bestCount = 0
  for (let i = 0; i < 7; i++) {
    const weekday = ((start + i) % 7) as Weekday
    if (counts[weekday] > bestCount) {
      bestWeekday = weekday
      bestCount = counts[weekday]
    }
  }
  if (bestCount === 0) return null
  return {
    weekday: bestWeekday,
    done: bestCount,
    average: bestCount / PRODUCTIVE_WEEKS
  }
}

/**
 * Row 3 (Evening tasks slip): over 90 days ending on `date`,
 * slip share for timed Tasks after 20:00 ÷ other timed Tasks.
 * Hidden with <7 on either side, 0 slips, or ratio ~1×.
 */
export const eveningSlip = (
  items: readonly InsightTask[],
  date: LocalDate
): EveningSlip | null => {
  const from = shiftDay(date, 1 - EVENING_DAYS)
  let eveningTotal = 0
  let eveningSlipped = 0
  let otherTotal = 0
  let otherSlipped = 0
  for (const item of items) {
    if (
      item.day === null
      || item.time === null
      || item.day < from
      || item.day > date
    ) continue
    const slipped = item.doneAt === null
      || doneDayOf(item.doneAt) > item.day
    if (item.time > EVENING_CUTOFF) {
      eveningTotal += 1
      if (slipped) eveningSlipped += 1
    } else {
      otherTotal += 1
      if (slipped) otherSlipped += 1
    }
  }
  if (
    eveningTotal < EVENING_MIN_TASKS
    || otherTotal < EVENING_MIN_TASKS
    || eveningSlipped === 0
    || otherSlipped === 0
  ) return null
  const num = eveningSlipped * otherTotal
  const den = otherSlipped * eveningTotal
  const more = num >= den
  const shown = more ? num / den : den / num
  if (roundTenths(shown) === 10) return null
  return {
    ratio: num / den,
    more,
    eveningSlipped,
    eveningTotal,
    otherSlipped,
    otherTotal
  }
}

/** Row 4 (Rescheduled 3+ times): open Tasks with 3+ moves. */
export const rescheduledCount = (
  items: readonly InsightTask[]
): number | null => {
  let count = 0
  for (const item of items) {
    if (item.doneAt === null && item.moves >= RESCHEDULED_MIN_MOVES)
      count += 1
  }
  return count === 0 ? null : count
}

/**
 * Row 5 (Busiest week ahead): busiest of the 4 Locale weeks
 * after `date`'s week. Earliest wins ties; null when empty.
 */
export const busiestWeekAhead = (
  items: readonly InsightTask[],
  date: LocalDate,
  weekStartsOn: number = firstDayOfWeek()
): BusiestWeek | null => {
  const weeks = aheadWeeks(date, weekStartsOn)
  const counts = new Array<number>(weeks.length).fill(0)
  for (const item of items) {
    if (item.day === null) continue
    const idx = weeks.findIndex(
      w => item.day! >= w.from && item.day! <= w.to
    )
    if (idx !== -1) counts[idx] += 1
  }
  let best: BusiestWeek | null = null
  for (let i = 0; i < weeks.length; i++) {
    const count = counts[i]
    if (count > 0 && (best === null || count > best.count))
      best = { ...weeks[i], count }
  }
  return best
}

/** Row 2's subtitle: "avg 5.2 done", in the Locale. */
export const formatProductiveAvg = (average: number): string => {
  const text = formatNumber(roundTenths(average) / 10, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })
  return `avg ${text} done`
}

/** Row 3's value: "2× more" or "1.5× less", dropping ".0". */
export const formatEveningSlip = (slip: EveningSlip): string => {
  const shown = slip.more ? slip.ratio : 1 / slip.ratio
  const times = formatNumber(roundTenths(shown) / 10, {
    maximumFractionDigits: 1
  })
  return `${times}× ${slip.more ? 'more' : 'less'}`
}

/** Row 4 & 5's count: "1 task" or "3 tasks", in Locale. */
export const formatTaskCount = (count: number): string =>
  `${formatNumber(count)} ${count === 1 ? 'task' : 'tasks'}`

/** Row 5's week span: "Dec 1–7" or "Nov 29–Dec 5". */
export const formatWeekRange = ({ from, to }: DateRange): string =>
  new Intl.DateTimeFormat(locale(), {
    month: 'short',
    day: 'numeric'
  })
    .formatRange(parseISO(from), parseISO(to))
    .replace(/\s*–\s*/, '–')
