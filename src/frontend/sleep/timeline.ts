/**
 * The Sleep Timeline's geometry (ADR 0002): one row per
 * day, from noon on that day to noon the next, local
 * time. Positions are fractions of a row's width, 0 at
 * its start and 1 at its end. Falling back to Figma's
 * snake layout means replacing this module.
 */
import { addDays, format, startOfDay } from 'date-fns'
import type { EpochMs, SleepPeriod } from '@shared/sleep'
import type { LocalDate } from '@shared/storage'

const HOUR = 3_600_000

/** A day's key, as `YYYY-MM-DD`. */
export const dayKey = (day: Date): LocalDate =>
  format(day, 'yyyy-MM-dd')

/** Noon on `day`, where its row starts. */
export const rowStart = (day: Date): EpochMs =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    12
  ).getTime()

/** Noon the next day, where `day`'s row ends. */
export const rowEnd = (day: Date): EpochMs =>
  rowStart(addDays(day, 1))

/**
 * The day whose row contains `time`, at midnight:
 * 1 AM on the 8th is in the 7th's row.
 */
export const rowOf = (time: EpochMs): Date => {
  const date = new Date(time)
  const day = startOfDay(date)
  return date.getHours() < 12 ? addDays(day, -1) : day
}

/**
 * Where `time` sits in `day`'s row. Rows scale to their
 * real length, so a DST day's row stays continuous
 * with its neighbours. Not clamped.
 */
export const toFraction = (
  time: EpochMs,
  day: Date
): number => {
  const start = rowStart(day)
  return (time - start) / (rowEnd(day) - start)
}

/** The time at `fraction` of `day`'s row. */
export const toTime = (
  fraction: number,
  day: Date
): EpochMs => {
  const start = rowStart(day)
  return start + fraction * (rowEnd(day) - start)
}

/** The part of a Period drawn on one row. */
export interface Segment {
  readonly period: SleepPeriod
  readonly from: number
  readonly to: number
  /** Whether the Period's Head is on this row. */
  readonly head: boolean
  /** Whether the Period's Tail is on this row. */
  readonly tail: boolean
}

/**
 * The segments drawn on `day`'s row: its own Periods,
 * whose Head is in the row, and the rest of the
 * previous row's Period that ran past noon. Periods
 * are at most 24 hours, so they span two rows at most.
 */
export const segmentsOf = (
  periods: readonly SleepPeriod[],
  day: Date
): Segment[] => {
  const start = rowStart(day)
  const end = rowEnd(day)
  return periods
    .filter(p => p.end > start && p.start < end)
    .map(period => ({
      period,
      from: Math.max(0, toFraction(period.start, day)),
      to: Math.min(1, toFraction(period.end, day)),
      head: period.start >= start,
      tail: period.end <= end
    }))
}

/** A label on the shared axis. */
export interface Tick {
  readonly fraction: number
  /** A time at this point, on any day. */
  readonly time: EpochMs
}

/** Ticks every `step` hours across a 24-hour row. */
export const axisTicks = (step = 3): Tick[] => {
  // A day without a DST change, so hours are even.
  const day = new Date(2000, 0, 1)
  const ticks: Tick[] = []
  for (let hour = 0; hour <= 24; hour += step) {
    ticks.push({
      fraction: hour / 24,
      time: rowStart(day) + hour * HOUR
    })
  }
  return ticks
}
