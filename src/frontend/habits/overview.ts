/**
 * Pure calculations for the Habit Overview Widget: the
 * tiles, completion per week and the finding rows, on
 * the shared rules in `./rules`. Each row is null when
 * it can't be computed, and the Widget hides it.
 */
import {
  endOfWeek,
  getDay,
  getWeek,
  parseISO,
  startOfWeek,
  type FirstWeekContainsDate
} from 'date-fns'
import { localDate, sameSpanLastMonth } from '@shared/dates'
import type { Habit, HabitEntry } from '@shared/habits'
import type { DateRange, LocalDate } from '@shared/storage'
import {
  completion,
  eachDay,
  isPerfectDay,
  ratePercent,
  shiftDay,
  slip,
  type Slip
} from './rules'

type Habits = readonly Habit[]
type Entries = readonly HabitEntry[]

/** 0 is Sunday, 1 Monday, ..., 6 Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * The Locale's week rules: the first day of the week,
 * and the day of January week 1 contains (1 or 4).
 */
export interface WeekRules {
  readonly weekStartsOn: number
  readonly firstWeekContainsDate: number
}

/** Bars in the completion per week chart. */
export const CHART_WEEKS = 12

/** Days Best day and Most skipped day look back over. */
export const WEEKDAY_DAYS = 84

export interface TodayTile {
  readonly done: number
  readonly counted: number
}

export interface WeekCompletion extends DateRange {
  /** The Locale week number, as in "W47". */
  readonly week: number
  /** Null when no Habit counted that week. */
  readonly rate: number | null
}

export interface HabitRate {
  readonly habit: Habit
  readonly rate: number
}

export interface SlippingHabit extends Slip {
  readonly habit: Habit
  /** The drop in whole points, as in "↓20%". */
  readonly points: number
}

export interface WeekdayRate {
  readonly weekday: Weekday
  readonly rate: number
}

export interface Trend {
  readonly current: number
  readonly previous: number
  /** Signed whole points, as in "+6%". */
  readonly points: number
  readonly comparedTo: DateRange
}

const monthRange = (date: LocalDate): DateRange =>
  ({ from: `${date.slice(0, 7)}-01`, to: date })

const weekdayOf = (day: LocalDate): Weekday =>
  getDay(parseISO(day)) as Weekday

const weekOptions = (rules: WeekRules): {
  weekStartsOn: Weekday
  firstWeekContainsDate: FirstWeekContainsDate
} => ({
  weekStartsOn: (((rules.weekStartsOn % 7) + 7) % 7) as Weekday,
  firstWeekContainsDate:
    rules.firstWeekContainsDate === 4 ? 4 : 1
})

/** Habits done and counted on the Selected Date. */
export const today = (
  habits: Habits,
  entries: Entries,
  date: LocalDate
): TodayTile | null => {
  const { done, counted } = completion(
    habits, entries, { from: date, to: date }, date
  )
  return counted === 0 ? null : { done, counted }
}

/** Perfect Days from the 1st of the month to the date. */
export const perfectDays = (
  habits: Habits,
  entries: Entries,
  date: LocalDate
): number => eachDay(monthRange(date))
  .filter(day => isPerfectDay(habits, entries, day))
  .length

/** The Rate of all Habits, month to date. */
export const thisMonth = (
  habits: Habits,
  entries: Entries,
  date: LocalDate
): number | null =>
  completion(habits, entries, monthRange(date), date).rate

/**
 * The Rate of all Habits in each of the last 12 Locale
 * weeks, oldest first. The last is the date's week, up
 * to the date.
 */
export const weeklyCompletion = (
  habits: Habits,
  entries: Entries,
  date: LocalDate,
  rules: WeekRules
): WeekCompletion[] => {
  const opts = weekOptions(rules)
  const weeks: WeekCompletion[] = []
  for (let i = CHART_WEEKS - 1; i >= 0; i--) {
    const day = parseISO(shiftDay(date, -7 * i))
    const from = localDate(startOfWeek(day, opts))
    const end = localDate(endOfWeek(day, opts))
    const to = end < date ? end : date
    weeks.push({
      from,
      to,
      week: getWeek(day, opts),
      rate: completion(
        habits, entries, { from, to }, date
      ).rate
    })
  }
  return weeks
}

/**
 * The Habit with the highest Rate month to date. Ties go
 * to the earlier Habit in `habits`.
 */
export const strongest = (
  habits: Habits,
  entries: Entries,
  date: LocalDate
): HabitRate | null => {
  let best: HabitRate | null = null
  for (const habit of habits) {
    const { rate } = completion(
      [habit], entries, monthRange(date), date
    )
    if (rate !== null && (best === null || rate > best.rate))
      best = { habit, rate }
  }
  return best
}

/**
 * The Slipping Habit with the biggest drop. Ties go to
 * the earlier Habit in `habits`.
 */
export const slipping = (
  habits: Habits,
  entries: Entries,
  date: LocalDate
): SlippingHabit | null => {
  let worst: SlippingHabit | null = null
  for (const habit of habits) {
    const found = slip(habit, entries, date)
    if (found && (worst === null || found.drop > worst.drop)) {
      worst = {
        habit, ...found, points: ratePercent(found.drop)
      }
    }
  }
  return worst
}

/**
 * Each weekday's Rate for all Habits over the 84 days
 * ending on the date, in the Locale's week order,
 * skipping weekdays with nothing counted.
 */
const weekdayRates = (
  habits: Habits,
  entries: Entries,
  date: LocalDate,
  weekStartsOn: number
): WeekdayRate[] => {
  const days = eachDay({
    from: shiftDay(date, 1 - WEEKDAY_DAYS), to: date
  })
  const start = ((weekStartsOn % 7) + 7) % 7
  const rates: WeekdayRate[] = []
  for (let i = 0; i < 7; i++) {
    const weekday = ((start + i) % 7) as Weekday
    let done = 0
    let counted = 0
    for (const day of days) {
      if (weekdayOf(day) !== weekday) continue
      const c = completion(
        habits, entries, { from: day, to: day }, date
      )
      done += c.done
      counted += c.counted
    }
    if (counted > 0) rates.push({ weekday, rate: done / counted })
  }
  return rates
}

const pick = (
  rates: readonly WeekdayRate[],
  better: (a: number, b: number) => boolean
): WeekdayRate | null =>
  rates.reduce<WeekdayRate | null>(
    (best, r) =>
      best === null || better(r.rate, best.rate) ? r : best,
    null
  )

/**
 * The weekday with the highest Rate for all Habits over
 * the last 84 days. Ties go to the earlier weekday in
 * the Locale's week.
 */
export const bestDay = (
  habits: Habits,
  entries: Entries,
  date: LocalDate,
  weekStartsOn: number
): WeekdayRate | null => pick(
  weekdayRates(habits, entries, date, weekStartsOn),
  (a, b) => a > b
)

/** As `bestDay`, for the lowest Rate. */
export const mostSkippedDay = (
  habits: Habits,
  entries: Entries,
  date: LocalDate,
  weekStartsOn: number
): WeekdayRate | null => pick(
  weekdayRates(habits, entries, date, weekStartsOn),
  (a, b) => a < b
)

/**
 * This month's Rate so far minus the Rate over the same
 * span of last month. Null if either has no Rate.
 */
export const trend = (
  habits: Habits,
  entries: Entries,
  date: LocalDate
): Trend | null => {
  const current = thisMonth(habits, entries, date)
  const comparedTo = sameSpanLastMonth(date)
  const previous = completion(
    habits, entries, comparedTo, date
  ).rate
  if (current === null || previous === null) return null
  return {
    current,
    previous,
    points: ratePercent(current - previous),
    comparedTo
  }
}
