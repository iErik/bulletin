/**
 * Pure calculations for the Habit Effects Widget: one
 * function per row (Sleep, Mood, Expenses, Calendar)
 * and their formatters. Each compares a Habit's done
 * and not-done counted days over the 90 days ending on
 * the Selected Date, picking the qualifying Habit with
 * the largest effect (ties go to the oldest Habit).
 */
import { getDay, parseISO } from 'date-fns'
import type { Transaction } from '@shared/expenses'
import type { Habit, HabitEntry } from '@shared/habits'
import {
  MOODS,
  type MoodEntry,
  type MoodKey
} from '@shared/mood'
import type { SleepPeriod } from '@shared/sleep'
import type { LocalDate } from '@shared/storage'
import { formatAmount } from '@/expenses/money'
import {
  firstDayOfWeek,
  formatNumber
} from '@/locale/format'
import {
  compareStrength,
  MIN_SIDE_DAYS,
  moodEffect as compareMoods,
  ratioFraction,
  type EffectTone,
  type MoodEffect
} from '@/mood/mood-effect'
import { last90Range } from '@/mood/overview'
import { sleepDays } from '@/sleep/stretches'
import type { Weekday } from './overview'
import { daySplit, shiftDay, streakRuns } from './rules'

const MINUTE_MS = 60_000
const MIN_STREAK_DAYS = 3
const MIN_ENDED_STREAKS = 3

const PLURAL_WEEKDAYS: readonly string[] = [
  'Sundays', 'Mondays', 'Tuesdays', 'Wednesdays',
  'Thursdays', 'Fridays', 'Saturdays'
]

/** Common shape returned by every row calculation. */
export interface EffectRow {
  readonly habit: Habit
  readonly value: string
  readonly tone: EffectTone
  readonly effect: number
}

export interface SleepEffectRow extends EffectRow {
  /** Signed whole-minute difference (done − not-done). */
  readonly minutes: number
}

export interface MoodEffectRow extends EffectRow {
  readonly mood: MoodEffect
}

export interface ExpensesEffectRow extends EffectRow {
  /** Signed centavos saved (not-done − done). */
  readonly savedCentavos: number
}

export interface CalendarEffectRow extends EffectRow {
  readonly weekday: Weekday
  readonly count: number
  readonly total: number
}

const byAge = (a: Habit, b: Habit): number =>
  a.created < b.created
    ? -1
    : a.created > b.created
      ? 1
      : a.id - b.id

const average = (values: readonly number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length

/** Rounds halves away from zero, dropping float noise. */
const roundHalfAway = (value: number): number => {
  const scaled = Number(Math.abs(value).toPrecision(12))
  return Math.sign(value) * Math.round(scaled) || 0
}

const roundedTenths = (effect: MoodEffect): number => {
  const { num, den } = ratioFraction(effect)
  return Math.round((10 * num) / den)
}

const collect = <T>(
  days: readonly LocalDate[],
  lookup: (day: LocalDate) => T | undefined
): T[] => {
  const out: T[] = []
  for (const day of days) {
    const value = lookup(day)
    if (value !== undefined) out.push(value)
  }
  return out
}

/** Signed minutes with Locale digits and U+2212 minus. */
export const formatSleepEffect = (minutes: number): string =>
  `${minutes > 0 ? '+' : '−'}${formatNumber(Math.abs(minutes))} min`

/** Ratio with one Locale decimal, dropping ".0". */
export const formatMoodEffect = (effect: MoodEffect): string => {
  const label = MOODS.find(m => m.key === effect.mood)
    ?.label.toLowerCase() ?? effect.mood
  const times = formatNumber(roundedTenths(effect) / 10, {
    maximumFractionDigits: 1
  })
  return `${times}× ${label}`
}

/** Daily spend difference with cents via `formatAmount`. */
export const formatExpensesEffect = (
  savedCentavos: number
): string =>
  `${formatAmount(Math.abs(savedCentavos))} ${
    savedCentavos > 0 ? 'saved' : 'more'
  }`

/** English plural weekday name, e.g. "Fridays". */
export const formatCalendarEffect = (
  weekday: Weekday
): string => PLURAL_WEEKDAYS[weekday]

/**
 * Sleep row: average Night on `D + 1` after done days
 * minus after not-done days. Pass Periods listed for
 * `sleepFetchRange({ from: shiftDay(last90Range(d).from,
 * 1), to: d })`. The Selected Date has no next-day Night
 * inside the window.
 */
export const sleepEffect = (
  habits: readonly Habit[],
  entries: readonly HabitEntry[],
  periods: readonly SleepPeriod[],
  selectedDate: LocalDate
): SleepEffectRow | null => {
  const range = last90Range(selectedDate)
  const nights = new Map<LocalDate, number>()
  for (const { day, night } of sleepDays(periods, {
    from: shiftDay(range.from, 1), to: selectedDate
  }))
    if (night) nights.set(day, night.asleepMs)
  const nextNight = (day: LocalDate): number | undefined =>
    nights.get(shiftDay(day, 1))
  let best: SleepEffectRow | null = null
  for (const habit of [...habits].sort(byAge)) {
    const split = daySplit(habit, entries, range, selectedDate)
    const doneMs = collect(split.done, nextNight)
    const notDoneMs = collect(split.notDone, nextNight)
    if (doneMs.length < MIN_SIDE_DAYS || notDoneMs.length < MIN_SIDE_DAYS)
      continue
    const minutes = roundHalfAway(
      (average(doneMs) - average(notDoneMs)) / MINUTE_MS
    )
    if (minutes === 0) continue
    const effect = Math.abs(minutes)
    if (best === null || effect > best.effect) {
      best = {
        habit,
        value: formatSleepEffect(minutes),
        tone: minutes > 0 ? 'good' : 'bad',
        effect,
        minutes
      }
    }
  }
  return best
}

/**
 * Mood row: Mood whose share shifts most between done
 * and not-done days with a Mood. Ratios rounding to
 * "1×" do not qualify.
 */
export const moodEffect = (
  habits: readonly Habit[],
  entries: readonly HabitEntry[],
  moods: readonly MoodEntry[],
  selectedDate: LocalDate
): MoodEffectRow | null => {
  const range = last90Range(selectedDate)
  const byDay = new Map<LocalDate, MoodKey>()
  for (const { date, mood } of moods)
    if (date >= range.from && date <= range.to) byDay.set(date, mood)
  const moodOn = (day: LocalDate): MoodKey | undefined => byDay.get(day)
  let best: MoodEffectRow | null = null
  for (const habit of [...habits].sort(byAge)) {
    const split = daySplit(habit, entries, range, selectedDate)
    const found = compareMoods(
      collect(split.done, moodOn),
      collect(split.notDone, moodOn)
    )
    if (!found || roundedTenths(found) === 10) continue
    if (best === null || compareStrength(found, best.mood) > 0) {
      best = {
        habit,
        value: formatMoodEffect(found),
        tone: found.tone,
        effect: Math.max(found.ratio, 1 / found.ratio),
        mood: found
      }
    }
  }
  return best
}

/**
 * Expenses row: average daily spend (Expenses only, 0
 * when none) on not-done counted days minus done days.
 */
export const expensesEffect = (
  habits: readonly Habit[],
  entries: readonly HabitEntry[],
  transactions: readonly Transaction[],
  selectedDate: LocalDate
): ExpensesEffectRow | null => {
  const range = last90Range(selectedDate)
  const spendByDay = new Map<LocalDate, number>()
  for (const { date, amount } of transactions) {
    if (date >= range.from && date <= range.to && amount < 0)
      spendByDay.set(date, (spendByDay.get(date) ?? 0) - amount)
  }
  const spend = (days: readonly LocalDate[]): number[] =>
    days.map(day => spendByDay.get(day) ?? 0)
  let best: ExpensesEffectRow | null = null
  for (const habit of [...habits].sort(byAge)) {
    const split = daySplit(habit, entries, range, selectedDate)
    if (
      split.done.length < MIN_SIDE_DAYS
      || split.notDone.length < MIN_SIDE_DAYS
    ) continue
    const savedCentavos = roundHalfAway(
      average(spend(split.notDone)) - average(spend(split.done))
    )
    if (savedCentavos === 0) continue
    const effect = Math.abs(savedCentavos)
    if (best === null || effect > best.effect) {
      best = {
        habit,
        value: formatExpensesEffect(savedCentavos),
        tone: savedCentavos > 0 ? 'good' : 'bad',
        effect,
        savedCentavos
      }
    }
  }
  return best
}

/**
 * Calendar row: weekday with the most ended 3+ day
 * Streaks (by last done day) in the window. Needs at
 * least 3 such Streaks; weekday ties follow the Locale's
 * week order (`firstDayOfWeek()`).
 */
export const calendarEffect = (
  habits: readonly Habit[],
  entries: readonly HabitEntry[],
  selectedDate: LocalDate,
  weekStartsOn: number = firstDayOfWeek()
): CalendarEffectRow | null => {
  const range = last90Range(selectedDate)
  const start = ((weekStartsOn % 7) + 7) % 7
  let best: CalendarEffectRow | null = null
  for (const habit of [...habits].sort(byAge)) {
    const ended = streakRuns(habit, entries, selectedDate).filter(run =>
      run.ended
      && run.days >= MIN_STREAK_DAYS
      && run.to >= range.from
      && run.to <= range.to)
    const total = ended.length
    if (total < MIN_ENDED_STREAKS) continue
    const counts = new Array<number>(7).fill(0)
    for (const run of ended) counts[getDay(parseISO(run.to))] += 1
    let weekday = start as Weekday
    let count = 0
    for (let i = 0; i < 7; i++) {
      const day = ((start + i) % 7) as Weekday
      if (counts[day] > count) {
        weekday = day
        count = counts[day]
      }
    }
    if (best === null || count * best.total > best.count * total) {
      best = {
        habit,
        value: formatCalendarEffect(weekday),
        tone: 'bad',
        effect: count / total,
        weekday,
        count,
        total
      }
    }
  }
  return best
}
