/**
 * The shared Habit rules (see `CONTEXT.md` and ADR
 * 0005): which days a Habit counts, Completion Rate,
 * Slipping, Perfect Day, day split and Streaks. Every
 * Habits Page Widget uses these instead of its own copy.
 */
import { addDays, parseISO } from 'date-fns'
import { localDate } from '@shared/dates'
import type { Habit, HabitEntry } from '@shared/habits'
import type { DateRange, LocalDate } from '@shared/storage'

type Habits = readonly Habit[]
type Entries = readonly HabitEntry[]

/** How many days Slipping compares on each side. */
export const SLIP_DAYS = 14

/** The drop, in points, that makes a Habit Slipping. */
export const SLIP_POINTS = 20

export interface Completion {
  /** Counted days on which the Habit was done. */
  readonly done: number
  /** Days the Habit counted. */
  readonly counted: number
  /** `done / counted`, or null with nothing counted. */
  readonly rate: number | null
}

export interface Slip {
  /** The Rate over the 14 days ending on the date. */
  readonly recent: number
  /** The Rate over the 14 days before those. */
  readonly earlier: number
  /** `earlier - recent`, as a fraction. */
  readonly drop: number
}

export const shiftDay = (
  day: LocalDate,
  days: number
): LocalDate => localDate(addDays(parseISO(day), days))

/** Every day of `range`, oldest first. */
export const eachDay = (range: DateRange): LocalDate[] => {
  const days: LocalDate[] = []
  for (let d = range.from; d <= range.to; d = shiftDay(d, 1))
    days.push(d)
  return days
}

/**
 * Whether `habit` counts on `day`: from its `created`
 * day up to the Selected Date, outside its Archive
 * Periods.
 */
export const countsOn = (
  habit: Habit,
  day: LocalDate,
  selectedDate: LocalDate
): boolean =>
  day >= habit.created
  && day <= selectedDate
  && !habit.archivePeriods.some(p =>
    day >= p.start && (p.end === null || day <= p.end))

/**
 * The Completion Rate of `habits` over `range`: all
 * their done days out of all their counted days.
 * Entries on days a Habit doesn't count are ignored.
 */
export const completion = (
  habits: Habits,
  entries: Entries,
  range: DateRange,
  selectedDate: LocalDate
): Completion => {
  const done = new Set(
    entries.map(e => `${e.habitId}|${e.date}`)
  )
  let doneDays = 0
  let counted = 0
  for (const day of eachDay(range)) {
    for (const habit of habits) {
      if (!countsOn(habit, day, selectedDate)) continue
      counted += 1
      if (done.has(`${habit.id}|${day}`)) doneDays += 1
    }
  }
  return {
    done: doneDays,
    counted,
    rate: counted === 0 ? null : doneDays / counted
  }
}

/**
 * How far `habit` is Slipping on the Selected Date, or
 * null when it isn't: its Rate over the last 14 days is
 * at least 20 points below the 14 days before. Both
 * spans need a Rate.
 */
export const slip = (
  habit: Habit,
  entries: Entries,
  selectedDate: LocalDate
): Slip | null => {
  const split = shiftDay(selectedDate, -SLIP_DAYS)
  const recent = completion([habit], entries, {
    from: shiftDay(split, 1), to: selectedDate
  }, selectedDate)
  const earlier = completion([habit], entries, {
    from: shiftDay(split, 1 - SLIP_DAYS), to: split
  }, selectedDate)
  if (recent.rate === null || earlier.rate === null)
    return null
  // Exact: earlier - recent >= 20 / 100.
  const gap = earlier.done * recent.counted
    - recent.done * earlier.counted
  const enough = gap * 100
    >= SLIP_POINTS * earlier.counted * recent.counted
  return enough
    ? {
        recent: recent.rate,
        earlier: earlier.rate,
        drop: earlier.rate - recent.rate
      }
    : null
}

/**
 * Whether every Habit that counted on `day` was done.
 * A day on which no Habit counted isn't one.
 */
export const isPerfectDay = (
  habits: Habits,
  entries: Entries,
  day: LocalDate
): boolean => {
  const { done, counted } = completion(
    habits, entries, { from: day, to: day }, day
  )
  return counted > 0 && done === counted
}

/**
 * A Rate, or a difference between two, as a whole
 * percentage, rounding halves away from zero. Every
 * Widget shows Rates through this, so they agree.
 */
export const ratePercent = (rate: number): number => {
  // Drops float noise, as in 0.285 * 100.
  const scaled = Number((Math.abs(rate) * 100).toPrecision(12))
  return Math.sign(rate) * Math.round(scaled) || 0
}

/** The days `habit` was done, from every Entry. */
const doneDays = (
  habit: Habit,
  entries: Entries
): Set<LocalDate> => new Set(
  entries
    .filter(entry => entry.habitId === habit.id)
    .map(entry => entry.date)
)

/** A Habit's counted days in a range, split in two. */
export interface DaySplit {
  /** Counted days it was done, oldest first. */
  readonly done: readonly LocalDate[]
  /** Counted days it wasn't done, oldest first. */
  readonly notDone: readonly LocalDate[]
}

/**
 * `habit`'s counted days in `range`, split by whether
 * it was done. Days it didn't count are in neither,
 * and so are Entries on them.
 */
export const daySplit = (
  habit: Habit,
  entries: Entries,
  range: DateRange,
  selectedDate: LocalDate
): DaySplit => {
  const done: LocalDate[] = []
  const notDone: LocalDate[] = []
  const doneOn = doneDays(habit, entries)
  for (const day of eachDay(range)) {
    if (!countsOn(habit, day, selectedDate)) continue
    if (doneOn.has(day)) done.push(day)
    else notDone.push(day)
  }
  return { done, notDone }
}

/** One Streak: done days in a row. */
export interface StreakRun {
  /** Its first done day. */
  readonly from: LocalDate
  /** Its last done day. */
  readonly to: LocalDate
  /**
   * How many days it was done. Archive Period days
   * inside it are skipped, not counted.
   */
  readonly days: number
  /**
   * Whether a counted day it wasn't done broke it,
   * before the Selected Date. The one open run, if
   * any, is the current Streak.
   */
  readonly ended: boolean
}

/**
 * Every Streak `habit` had up to the Selected Date,
 * oldest first. Days in Archive Periods are skipped
 * over, and the run starts no earlier than `created`.
 * A counted day it wasn't done ends the run, except
 * the Selected Date itself, which may still be done.
 */
export const streakRuns = (
  habit: Habit,
  entries: Entries,
  selectedDate: LocalDate
): StreakRun[] => {
  const doneOn = doneDays(habit, entries)
  const runs: StreakRun[] = []
  let open: StreakRun | null = null
  for (
    let day = habit.created;
    day <= selectedDate;
    day = shiftDay(day, 1)
  ) {
    if (!countsOn(habit, day, selectedDate)) continue
    if (doneOn.has(day)) {
      const from: LocalDate = open?.from ?? day
      const days: number = (open?.days ?? 0) + 1
      open = { from, to: day, days, ended: false }
    } else if (open && day < selectedDate) {
      runs.push({ ...open, ended: true })
      open = null
    }
  }
  if (open) runs.push(open)
  return runs
}
