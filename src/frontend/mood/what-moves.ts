/**
 * Pure calculations for the "What moves your mood"
 * Widget: one function per row (Sleep, Habits, Expenses,
 * Calendar). Each splits the days of the 90-day window
 * ending on the Selected Date into a condition's true
 * and false days, keeps those with a Mood, and returns
 * the strongest Mood effect, or null when the row is
 * hidden. Days without a Mood, or without the row's
 * Tracker data, are in neither group.
 */
import {
  addMonths,
  getDay,
  lastDayOfMonth,
  parseISO
} from 'date-fns'
import { localDate } from '@shared/dates'
import type {
  Budget,
  LocalMonth,
  Transaction
} from '@shared/expenses'
import type { Habit, HabitEntry } from '@shared/habits'
import {
  MOODS,
  type MoodEntry,
  type MoodKey
} from '@shared/mood'
import type { SleepPeriod } from '@shared/sleep'
import type { LocalDate } from '@shared/storage'
import { monthPace, paceOn } from '@/expenses/month-pace'
import { countsOn } from '@/habits/rules'
import { formatNumber } from '@/locale/format'
import { sleepDays } from '@/sleep/stretches'
import {
  compareStrength,
  moodEffect,
  ratioFraction,
  type MoodEffect
} from './mood-effect'
import { last90Range } from './overview'

/** One shown row: the effect and its value text. */
export interface MoodRow {
  readonly effect: MoodEffect
  /** Such as "+18% happy" or "2.1× happy". */
  readonly value: string
}

export interface SleepRow extends MoodRow {
  readonly goalMinutes: number
}

export interface HabitsRow extends MoodRow {
  readonly habit: Habit
}

/** The day's side, or null to leave it out. */
type Classify = (day: LocalDate) => boolean | null

const MINUTE_MS = 60_000

/** Rounds a positive fraction to the nearest integer. */
const roundRatio = (num: number, den: number): number =>
  Math.round(num / den)

/**
 * The effect as the brief writes it: under 2× either
 * way, a signed whole percentage ("+18% happy",
 * "−40% anxious"); at 2× or more, the ratio with one
 * decimal, a trailing ".0" dropped ("2.1× happy",
 * "2× stressed", "0.4× anxious").
 */
export const formatMoodEffect = (effect: MoodEffect): string => {
  const { num, den } = ratioFraction(effect)
  const label = MOODS.find(m => m.key === effect.mood)?.label
    .toLowerCase() ?? effect.mood
  if (num >= 2 * den || den >= 2 * num) {
    const tenths = roundRatio(10 * num, den) / 10
    const times = formatNumber(tenths, { maximumFractionDigits: 1 })
    return `${times}× ${label}`
  }
  const percent = roundRatio(100 * Math.abs(num - den), den)
  const sign = num >= den ? '+' : '−'
  return `${sign}${formatNumber(percent)}% ${label}`
}

/** Whether the value would show no change ("+0%"). */
const noChange = (effect: MoodEffect): boolean => {
  const { num, den } = ratioFraction(effect)
  return num < 2 * den && den < 2 * num
    && roundRatio(100 * Math.abs(num - den), den) === 0
}

const effectFor = (
  moods: readonly MoodEntry[],
  date: LocalDate,
  classify: Classify
): MoodEffect | null => {
  const { from, to } = last90Range(date)
  const byDay = new Map<LocalDate, MoodKey>()
  for (const entry of moods) {
    if (entry.date >= from && entry.date <= to)
      byDay.set(entry.date, entry.mood)
  }
  const onTrue: MoodKey[] = []
  const onFalse: MoodKey[] = []
  for (const [day, mood] of byDay) {
    const side = classify(day)
    if (side === true) onTrue.push(mood)
    else if (side === false) onFalse.push(mood)
  }
  const effect = moodEffect(onTrue, onFalse)
  return effect === null || noChange(effect) ? null : effect
}

const rowOf = (effect: MoodEffect): MoodRow =>
  ({ effect, value: formatMoodEffect(effect) })

/**
 * "Slept <Sleep Goal> or more": true when the day's
 * Night lasts at least the Sleep Goal. Days without a
 * Night are left out. Pass the Periods listed for
 * `sleepFetchRange(last90Range(date))`.
 */
export const sleepRow = (
  moods: readonly MoodEntry[],
  periods: readonly SleepPeriod[],
  goalMinutes: number,
  date: LocalDate
): SleepRow | null => {
  const nights = new Map<LocalDate, number>()
  for (const { day, night } of sleepDays(periods, last90Range(date)))
    if (night) nights.set(day, night.asleepMs)
  const goalMs = goalMinutes * MINUTE_MS
  const effect = effectFor(moods, date, day => {
    const asleep = nights.get(day)
    return asleep === undefined ? null : asleep >= goalMs
  })
  return effect && { ...rowOf(effect), goalMinutes }
}

const byAge = (a: Habit, b: Habit): number =>
  a.created < b.created
    ? -1
    : a.created > b.created
      ? 1
      : a.id - b.id

/**
 * "<Habit name>": true on days the Habit was done,
 * false on days it counted but wasn't. Every Habit,
 * archived ones included, is tried, and the strongest
 * effect is shown; a tie goes to the older Habit.
 */
export const habitsRow = (
  moods: readonly MoodEntry[],
  habits: readonly Habit[],
  entries: readonly HabitEntry[],
  date: LocalDate
): HabitsRow | null => {
  const done = new Set(entries.map(e => `${e.habitId}|${e.date}`))
  let best: HabitsRow | null = null
  for (const habit of [...habits].sort(byAge)) {
    const effect = effectFor(moods, date, day =>
      countsOn(habit, day, date)
        ? done.has(`${habit.id}|${day}`)
        : null)
    if (!effect) continue
    if (best === null || compareStrength(effect, best.effect) > 0)
      best = { ...rowOf(effect), habit }
  }
  return best
}

/** Each month the window touches, oldest first. */
const monthsOf = (from: LocalDate, to: LocalDate): LocalMonth[] => {
  const months: LocalMonth[] = []
  let month = parseISO(`${from.slice(0, 7)}-01`)
  while (localDate(month).slice(0, 7) <= to.slice(0, 7)) {
    months.push(localDate(month).slice(0, 7))
    month = addMonths(month, 1)
  }
  return months
}

/**
 * "Over budget pace": true when the month's running
 * spend through that day is above the Budget's pace
 * line (Month Pace). Days in a month without a Budget
 * are left out. `budgets` holds each month's Budget as
 * `getBudget` returns it. Pass the Transactions from the
 * 1st of the window's first month to `date`.
 */
export const expensesRow = (
  moods: readonly MoodEntry[],
  transactions: readonly Transaction[],
  budgets: ReadonlyMap<LocalMonth, Budget | null>,
  date: LocalDate
): MoodRow | null => {
  const over = new Map<LocalDate, boolean>()
  for (const month of monthsOf(last90Range(date).from, date)) {
    const budget = budgets.get(month) ?? null
    if (budget === null) continue
    const last = localDate(lastDayOfMonth(parseISO(`${month}-01`)))
    const end = last < date ? last : date
    const { days, pace } = monthPace(transactions, budget, parseISO(end))
    if (pace === null) continue
    for (const day of days) {
      if (day.total !== null)
        over.set(day.date, day.total > paceOn(pace, day.day))
    }
  }
  const effect = effectFor(moods, date, day => over.get(day) ?? null)
  return effect && rowOf(effect)
}

/** "Weekends": true on Saturdays and Sundays. */
export const calendarRow = (
  moods: readonly MoodEntry[],
  date: LocalDate
): MoodRow | null => {
  const effect = effectFor(moods, date, day => {
    const weekday = getDay(parseISO(day))
    return weekday === 0 || weekday === 6
  })
  return effect && rowOf(effect)
}
