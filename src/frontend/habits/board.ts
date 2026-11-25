/**
 * Pure calculations for the Habit Board Widget: month-so-far
 * window, date-axis ticks, row ordering, per-day cells,
 * Streaks, Completion Rate and Slipping, built on the shared
 * rules in `./rules`.
 */
import { parseISO } from 'date-fns'
import {
  HABIT_GOAL,
  type Habit,
  type HabitEntry
} from '@shared/habits'
import type { DateRange, LocalDate } from '@shared/storage'
import { formatDate } from '@/locale/format'
import {
  completion,
  countsOn,
  eachDay,
  ratePercent,
  slip,
  streakRuns
} from './rules'

/** Streaks of at least this many days are highlighted. */
export const STREAK_HIGHLIGHT_DAYS = 7

/** Whole-% Rates strictly below this use the low tone. */
export const LOW_RATE_PERCENT = 50

const TICK_STEP = 10
const MIN_TICK_END_GAP = 5

/** Visual state of one day's cell in a Habit row. */
export type BoardCellState = 'done' | 'dim' | 'blank'

/** Colour tone for a row's Completion Rate. */
export type BoardRateTone = 'good' | 'neutral' | 'low'

/** One day's cell in a Habit Board row. */
export interface BoardCell {
  readonly date: LocalDate
  readonly state: BoardCellState
  /** Done as part of the current (open) Streak. */
  readonly inCurrentStreak: boolean
  /** True on the Selected Date when the Habit counted. */
  readonly isSelected: boolean
  /** True when clicking toggles this day's Entry. */
  readonly interactive: boolean
}

/** One tick label on the Board's date axis. */
export interface BoardTick {
  /** 0-based column index inside `days`. */
  readonly index: number
  readonly date: LocalDate
  readonly label: string
  /** True for the final column (`Today` or short date). */
  readonly isLast: boolean
}

/** One Habit's row on the Habit Board. */
export interface BoardRow {
  readonly habit: Habit
  readonly cells: readonly BoardCell[]
  /** Current Streak in days (0 when none). */
  readonly streak: number
  /** True when `streak >= STREAK_HIGHLIGHT_DAYS`. */
  readonly highlightStreak: boolean
  /** All-time longest Streak up to the Selected Date. */
  readonly best: number
  /** Whole-% Completion Rate in the window, or null. */
  readonly rate: number | null
  readonly rateTone: BoardRateTone
  /** True when the Habit is Slipping on Selected Date. */
  readonly slipping: boolean
}

/** Options for computing the Habit Board. */
export interface BoardOptions {
  /** Habit Goal percentage (defaults to `HABIT_GOAL.default`). */
  readonly goal?: number
  /** Whether the Selected Date is today (labels final tick). */
  readonly isToday?: boolean
}

/** Full computed view model for the Habit Board Widget. */
export interface HabitBoard {
  readonly range: DateRange
  readonly days: readonly LocalDate[]
  readonly ticks: readonly BoardTick[]
  readonly rows: readonly BoardRow[]
}

/** Month-so-far window: 1st of the month to `selectedDate`. */
export const boardWindow = (
  selectedDate: LocalDate
): DateRange => ({
  from: `${selectedDate.slice(0, 7)}-01`,
  to: selectedDate
})

/**
 * Formats the Board header range in the Locale's short
 * format: `"Nov 1"` on day 1, `"Nov 1 – Nov 19"` otherwise.
 */
export const formatBoardRange = (range: DateRange): string => {
  const from = formatDate(parseISO(range.from), 'short')
  if (range.from === range.to) return from
  return `${from} – ${formatDate(parseISO(range.to), 'short')}`
}

/**
 * Axis ticks for `days`: day 1, 11th and 21st (omitting any
 * tick within 4 columns of the end), plus the final column
 * labelled `"Today"` when `isToday`, else its short date.
 */
export const boardTicks = (
  days: readonly LocalDate[],
  isToday: boolean
): BoardTick[] => {
  if (days.length === 0) return []
  const last = days.length - 1
  const ticks: BoardTick[] = []
  for (
    let index = 0;
    index + MIN_TICK_END_GAP <= last;
    index += TICK_STEP
  ) {
    const date = days[index]
    ticks.push({
      index,
      date,
      label: formatDate(parseISO(date), 'short'),
      isLast: false
    })
  }
  const finalDate = days[last]
  ticks.push({
    index: last,
    date: finalDate,
    label: isToday
      ? 'Today'
      : formatDate(parseISO(finalDate), 'short'),
    isLast: true
  })
  return ticks
}

/**
 * Classifies a whole-% Rate against `goal` and 50%:
 * `'good'` at or above Goal, `'low'` below 50%, else
 * `'neutral'`.
 */
export const rateTone = (
  rate: number | null,
  goal: number
): BoardRateTone => {
  if (rate === null) return 'neutral'
  if (rate >= goal) return 'good'
  if (rate < LOW_RATE_PERCENT) return 'low'
  return 'neutral'
}

const byBoardOrder = (a: Habit, b: Habit): number => {
  if (a.archived !== b.archived) return a.archived ? 1 : -1
  if (a.created !== b.created)
    return a.created < b.created ? -1 : 1
  return a.id - b.id
}

const groupByHabit = (
  entries: readonly HabitEntry[]
): Map<number, HabitEntry[]> => {
  const map = new Map<number, HabitEntry[]>()
  for (const entry of entries) {
    const list = map.get(entry.habitId)
    if (list) list.push(entry)
    else map.set(entry.habitId, [entry])
  }
  return map
}

const buildRow = (
  habit: Habit,
  entries: readonly HabitEntry[],
  range: DateRange,
  days: readonly LocalDate[],
  selectedDate: LocalDate,
  goal: number
): BoardRow | null => {
  const stats = completion([habit], entries, range, selectedDate)
  if (stats.counted === 0) return null

  const runs = streakRuns(habit, entries, selectedDate)
  const lastRun = runs[runs.length - 1]
  const current = lastRun && !lastRun.ended ? lastRun : null
  const streak = current?.days ?? 0
  const best = runs.reduce(
    (max, run) => Math.max(max, run.days),
    0
  )

  const doneOn = new Set(entries.map(entry => entry.date))
  const cells: BoardCell[] = days.map(date => {
    const counted = countsOn(habit, date, selectedDate)
    const state: BoardCellState = !counted
      ? 'blank'
      : doneOn.has(date)
        ? 'done'
        : 'dim'
    return {
      date,
      state,
      inCurrentStreak: state === 'done'
        && current !== null
        && date >= current.from
        && date <= current.to,
      isSelected: counted && date === selectedDate,
      interactive: !habit.archived && counted
    }
  })

  const rate = stats.rate === null
    ? null
    : ratePercent(stats.rate)

  return {
    habit,
    cells,
    streak,
    highlightStreak: streak >= STREAK_HIGHLIGHT_DAYS,
    best,
    rate,
    rateTone: rateTone(rate, goal),
    slipping: slip(habit, entries, selectedDate) !== null
  }
}

/**
 * Builds the Habit Board model for `selectedDate`. Active
 * Habits come first (oldest first), then archived Habits
 * (oldest first), keeping only Habits with at least one
 * counted day in the month-so-far window.
 */
export const habitBoard = (
  habits: readonly Habit[],
  entries: readonly HabitEntry[],
  selectedDate: LocalDate,
  options: BoardOptions = {}
): HabitBoard => {
  const goal = options.goal ?? HABIT_GOAL.default
  const isToday = options.isToday ?? false
  const range = boardWindow(selectedDate)
  const days = eachDay(range)
  const ticks = boardTicks(days, isToday)
  const byHabit = groupByHabit(entries)

  const rows: BoardRow[] = []
  for (const habit of [...habits].sort(byBoardOrder)) {
    const row = buildRow(
      habit,
      byHabit.get(habit.id) ?? [],
      range,
      days,
      selectedDate,
      goal
    )
    if (row) rows.push(row)
  }

  return { range, days, ticks, rows }
}
