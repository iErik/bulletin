/**
 * Sleep Schedule maths: Locale week, circular averages,
 * ± consistency, and the clock axis. Pure: no Vue.
 */
import {
  addDays,
  startOfDay,
  startOfWeek
} from 'date-fns'
import { localDate } from '@shared/dates'
import type { LocalDate } from '@shared/storage'
import type { EpochMs } from '@shared/sleep'
import type { Stretch } from './stretches'

export type ClockMinutes = number
export type AxisHours = number

export interface ScheduleDay {
  readonly day: LocalDate
  readonly night: Stretch | null
}

export interface ScheduleAxis {
  readonly start: AxisHours
  readonly end: AxisHours
  readonly marks: readonly AxisHours[]
}

export interface ScheduleSpan {
  readonly bed: AxisHours
  readonly wake: AxisHours
}

export interface ScheduleStats {
  readonly averageBed: ClockMinutes | null
  readonly averageWake: ClockMinutes | null
  readonly deviationMin: number | null
}

const DAY_MIN = 24 * 60
const DAY_H = 24
const DEFAULT_START = 22
const DEFAULT_END = 34
const MAX_SPAN = 24
const STEP = 2

const minutesOf = (at: EpochMs): ClockMinutes => {
  const d = new Date(at)
  return d.getHours() * 60 + d.getMinutes()
    + d.getSeconds() / 60 + d.getMilliseconds() / 60_000
}
const hoursOf = (at: EpochMs): number => minutesOf(at) / 60

export const circularDiff = (a: ClockMinutes, b: ClockMinutes): number => {
  const raw = Math.abs(a - b) % DAY_MIN
  return Math.min(raw, DAY_MIN - raw)
}

/** Opposite times fall back to linear mean on `fallback`. */
export const circularMean = (
  times: readonly ClockMinutes[],
  fallback?: readonly ClockMinutes[],
  anchor = DEFAULT_START * 60
): ClockMinutes | null => {
  if (times.length === 0) return null
  let sin = 0
  let cos = 0
  for (const t of times) {
    const a = (t / DAY_MIN) * 2 * Math.PI
    sin += Math.sin(a)
    cos += Math.cos(a)
  }
  if (Math.hypot(sin, cos) < 1e-10) {
    const source = fallback ?? times.map(t => {
      let m = t
      while (m < anchor) m += DAY_MIN
      while (m >= anchor + DAY_MIN) m -= DAY_MIN
      return m
    })
    const mean = source.reduce((a, b) => a + b, 0)
      / source.length
    return ((mean % DAY_MIN) + DAY_MIN) % DAY_MIN
  }
  const mean = Math.atan2(sin, cos) / (2 * Math.PI) * DAY_MIN
  return ((mean % DAY_MIN) + DAY_MIN) % DAY_MIN
}

const floorStep = (h: number): number => Math.floor(h / STEP) * STEP
const ceilStep = (h: number): number => Math.ceil(h / STEP) * STEP

const marksBetween = (start: AxisHours, end: AxisHours): AxisHours[] => {
  const marks: AxisHours[] = []
  for (let h = start; h <= end + 1e-9; h += STEP) marks.push(h)
  return marks
}

const unwrap = (clockH: number, origin: AxisHours): AxisHours => {
  let h = ((clockH % DAY_H) + DAY_H) % DAY_H
  while (h < origin) h += DAY_H
  while (h >= origin + DAY_H) h -= DAY_H
  return h
}

export const nightSpan = (
  night: Stretch,
  origin: AxisHours = DEFAULT_START
): ScheduleSpan => {
  const bed = unwrap(hoursOf(night.start), origin)
  return {
    bed,
    wake: bed + (night.end - night.start) / 3_600_000
  }
}

const placeNight = (
  night: Stretch,
  start: AxisHours,
  end: AxisHours
): ScheduleSpan => {
  const dur = (night.end - night.start) / 3_600_000
  const bedA = unwrap(hoursOf(night.start), start)
  const a = { bed: bedA, wake: bedA + dur }
  const b = { bed: bedA - DAY_H, wake: bedA + dur - DAY_H }
  const cost = (s: ScheduleSpan): number =>
    ceilStep(Math.max(end, s.wake))
    - floorStep(Math.min(start, s.bed))
  return cost(a) <= cost(b) ? a : b
}

/** Default 22–10; widens to 2h marks, ≤24h, min span. */
export const scheduleAxis = (
  nights: readonly Stretch[]
): ScheduleAxis => {
  if (nights.length === 0) {
    return {
      start: DEFAULT_START,
      end: DEFAULT_END,
      marks: marksBetween(DEFAULT_START, DEFAULT_END)
    }
  }
  let start = DEFAULT_START
  let end = DEFAULT_END
  for (const n of nights) {
    const s = placeNight(n, start, end)
    start = Math.min(start, s.bed)
    end = Math.max(end, s.wake)
  }
  start = floorStep(start)
  end = ceilStep(end)
  if (end - start > MAX_SPAN) {
    const mid = (start + end) / 2
    start = floorStep(mid - MAX_SPAN / 2)
    end = start + MAX_SPAN
  }
  return { start, end, marks: marksBetween(start, end) }
}

export const placeOnAxis = (night: Stretch, axis: ScheduleAxis): ScheduleSpan =>
  placeNight(night, axis.start, axis.end)

export const axisRatio = (hours: AxisHours, axis: ScheduleAxis): number => {
  const span = axis.end - axis.start
  return span <= 0 ? 0 : (hours - axis.start) / span
}

export const clockOnAxis = (
  min: ClockMinutes,
  axis: ScheduleAxis
): AxisHours => {
  let h = unwrap(min / 60, axis.start)
  if (h > axis.end && h - DAY_H >= axis.start) h -= DAY_H
  if (h < axis.start && h + DAY_H <= axis.end) h += DAY_H
  return h
}

export const scheduleStats = (
  nights: readonly Stretch[]
): ScheduleStats => {
  if (nights.length === 0) {
    return {
      averageBed: null, averageWake: null, deviationMin: null
    }
  }
  const beds = nights.map(n => minutesOf(n.start))
  const wakes = nights.map(n => minutesOf(n.end))
  const averageBed = circularMean(
    beds, nights.map(n => nightSpan(n).bed * 60)
  )
  const averageWake = circularMean(
    wakes, nights.map(n => nightSpan(n).wake * 60)
  )
  if (averageBed === null)
    return { averageBed: null, averageWake, deviationMin: null }

  return {
    averageBed,
    averageWake,
    deviationMin: Math.round(
      beds.reduce(
        (s, b) => s + circularDiff(b, averageBed), 0
      ) / beds.length
    )
  }
}

/** Seven Locale-week days; days after `selected` blank. */
export const scheduleWeek = (
  selected: Date,
  days: readonly ScheduleDay[],
  weekStartsOn: number
): ScheduleDay[] => {
  const weekStart = startOfWeek(startOfDay(selected), {
    weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6
  })
  const byDay = new Map(days.map(d => [d.day, d.night] as const))
  const selectedKey = localDate(selected)
  return Array.from({ length: 7 }, (_, i) => {
    const day = localDate(addDays(weekStart, i))
    return {
      day,
      night: day > selectedKey ? null : byDay.get(day) ?? null
    }
  })
}

export const axisLabel = (mark: AxisHours): string =>
  String(Math.round(mark) % 24).padStart(2, '0')
