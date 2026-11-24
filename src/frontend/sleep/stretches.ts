/**
 * Nights, Naps and Wake-ups, derived from Periods
 * (ADR 0004). Pure and synchronous: no Vue, store or
 * storage, so every Widget can share it.
 *
 * Periods separated by a gap of an hour or less form
 * one Stretch, and each such gap is a Wake-up. A Stretch
 * belongs to the day its last Period ends on. A day's
 * longest Stretch is its Night, the earlier one when
 * two tie, and every other Stretch is a Nap. Length
 * counts time asleep only, not the gaps.
 *
 * A Tail at exactly midnight belongs to the new
 * calendar day, via `localDate`, the same rule as
 * everywhere else.
 */
import {
  addDays,
  eachDayOfInterval,
  parseISO
} from 'date-fns'
import { localDate } from '@shared/dates'
import type { DateRange, LocalDate } from '@shared/storage'
import type { EpochMs, SleepPeriod } from '@shared/sleep'

/**
 * The longest gap that is still a Wake-up: an hour,
 * fixed for now, as ADR 0004 decides.
 */
export const WAKE_UP_MAX_GAP_MS = 60 * 60 * 1000

/** One run of sleep, filed on the day it ends. */
export interface Stretch {
  /** The day its last Period ends, local time. */
  readonly day: LocalDate
  /** Its first Period's Head. */
  readonly start: EpochMs
  /** Its last Period's Tail. */
  readonly end: EpochMs
  /**
   * Time asleep: the sum of its Periods, not the
   * gaps between them.
   */
  readonly asleepMs: number
  /** Its Periods, oldest Head first. */
  readonly periods: readonly SleepPeriod[]
  /** How many Wake-ups join those Periods. */
  readonly wakeUps: number
}

/** One day's Night, and its Naps earliest first. */
export interface SleepDay {
  readonly day: LocalDate
  /**
   * The day's longest Stretch, or null when none
   * ends on it.
   */
  readonly night: Stretch | null
  /** Every other Stretch, earliest first. */
  readonly naps: readonly Stretch[]
}

const stretchOf = (
  group: readonly SleepPeriod[]
): Stretch => {
  const first = group[0]
  const last = group[group.length - 1]
  const asleepMs = group.reduce(
    (asleep, period) => asleep + period.end - period.start,
    0
  )
  return {
    day: localDate(new Date(last.end)),
    start: first.start,
    end: last.end,
    asleepMs,
    periods: [...group],
    wakeUps: group.length - 1
  }
}

const joins = (
  previous: SleepPeriod,
  period: SleepPeriod
): boolean =>
  period.start - previous.end <= WAKE_UP_MAX_GAP_MS

/**
 * Joins `periods` into Stretches, oldest Head first.
 * Input order doesn't matter. A gap of
 * `WAKE_UP_MAX_GAP_MS` or less joins the two Periods
 * and counts as a Wake-up. A gap of zero does too:
 * Periods may touch, since storage allows it.
 */
export const stretches = (
  periods: readonly SleepPeriod[]
): Stretch[] => {
  const sorted = [...periods].sort(
    (a, b) => a.start - b.start
  )
  const groups: SleepPeriod[][] = []
  for (const period of sorted) {
    const open = groups.at(-1)
    const previous = open?.at(-1)
    if (open && previous && joins(previous, period))
      open.push(period)
    else groups.push([period])
  }
  return groups.map(stretchOf)
}

const pickNight = (
  dayStretches: readonly Stretch[]
): Stretch | null => {
  let night: Stretch | null = null
  for (const stretch of dayStretches) {
    if (
      night === null
      || stretch.asleepMs > night.asleepMs
      || (
        stretch.asleepMs === night.asleepMs
        && stretch.start < night.start
      )
    ) night = stretch
  }
  return night
}

const daysOf = (range: DateRange): LocalDate[] =>
  eachDayOfInterval({
    start: parseISO(range.from),
    end: parseISO(range.to)
  }).map(localDate)

/**
 * One SleepDay per day of `range`, oldest first. Days
 * outside `range` are left out, so a caller never
 * reads a half-seen edge day. A day with no Stretch
 * ending on it has no Night and no Naps.
 *
 * Pass the Periods listed for
 * `sleepFetchRange(range)`.
 */
export const sleepDays = (
  periods: readonly SleepPeriod[],
  range: DateRange
): SleepDay[] => {
  const byDay = new Map<LocalDate, Stretch[]>()
  for (const stretch of stretches(periods)) {
    const found = byDay.get(stretch.day)
    if (found) found.push(stretch)
    else byDay.set(stretch.day, [stretch])
  }
  return daysOf(range).map(day => {
    const dayStretches = byDay.get(day) ?? []
    const night = pickNight(dayStretches)
    const naps = dayStretches
      .filter(stretch => stretch !== night)
      .sort((a, b) => a.start - b.start)
    return { day, night, naps }
  })
}

const shiftDay = (
  day: LocalDate,
  days: number
): LocalDate =>
  localDate(addDays(parseISO(day), days))

/**
 * The range to pass to `window.bulletin.sleep.list`
 * for `range`: `range` widened by one day either
 * side. Storage lists a Period by its Head's day, so
 * the extra days are what classify the edges.
 *
 * The day before catches the Head of a Night that
 * ends on `range.from`. The day after catches a
 * Period just past midnight that extends a Stretch
 * and moves it off `range.to`.
 *
 * A Stretch that started before this widened range
 * shows a late `start` and too little `asleepMs`.
 * That only happens when several chained Periods
 * reach more than about 24 hours back from
 * `range.from`.
 */
export const sleepFetchRange = (
  range: DateRange
): DateRange => ({
  from: shiftDay(range.from, -1),
  to: shiftDay(range.to, 1)
})
