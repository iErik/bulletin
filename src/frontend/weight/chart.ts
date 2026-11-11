/**
 * The Weight chart's geometry, without rendering: its
 * 11-month window, which Entries it draws, the y axis,
 * the monotone curve's value at any day, and the
 * nearest Entry to a day. x is in days from the
 * window's first day, with each day's Entry at the
 * day's centre; y is in kg.
 */
import {
  addMonths,
  addYears,
  differenceInCalendarDays,
  endOfMonth,
  parseISO,
  startOfDay,
  startOfMonth
} from 'date-fns'
import { localDate } from '@shared/dates'
import type { DateRange } from '@shared/storage'
import type { WeightEntry } from '@shared/weight'
import { GRAMS_PER_KG } from './format'

/** Months shown before and after the centre month. */
export const MONTHS_EACH_SIDE = 5

/** How far outside the window to look for edge Entries. */
const EDGE_REACH_YEARS = 1

const Y_STEP = 10
const MIN_Y_SPAN = 20

/** The y axis with no Entries, in kg. */
export const EMPTY_Y_DOMAIN = [40, 80] as const

export interface ChartWindow {
  /** The months' first days, oldest first. */
  readonly months: readonly Date[]
  /** The first and last days, both included. */
  readonly start: Date
  readonly end: Date
}

export interface Point {
  readonly x: number
  readonly y: number
}

export interface EntryPoint extends Point {
  readonly entry: WeightEntry
  readonly date: Date
}

export interface ChartPoints {
  /** Entries in the window, oldest first. */
  readonly visible: readonly EntryPoint[]
  /** `visible`, plus the nearest Entry outside each edge. */
  readonly curve: readonly EntryPoint[]
}

/** The 11 months centred on `day`'s month. */
export const chartWindow = (day: Date): ChartWindow => {
  const months = Array.from(
    { length: 2 * MONTHS_EACH_SIDE + 1 },
    (_, i) => startOfMonth(
      addMonths(day, i - MONTHS_EACH_SIDE)
    )
  )
  return {
    months,
    start: months[0],
    end: startOfDay(endOfMonth(months[months.length - 1]))
  }
}

/** The days to load: the window, and a year each side. */
export const loadRange = (
  window: ChartWindow
): DateRange => ({
  from: localDate(
    addYears(window.start, -EDGE_REACH_YEARS)
  ),
  to: localDate(addYears(window.end, EDGE_REACH_YEARS))
})

/** The window's length in days, so its x extent. */
export const windowDays = (window: ChartWindow): number =>
  differenceInCalendarDays(window.end, window.start) + 1

/** The x of `date`'s centre. */
export const dayX = (
  window: ChartWindow,
  date: Date
): number =>
  differenceInCalendarDays(date, window.start) + 0.5

/** Places Entries, given oldest first, on the chart. */
export const chartPoints = (
  window: ChartWindow,
  entries: readonly WeightEntry[]
): ChartPoints => {
  const days = windowDays(window)
  const points = entries.map(entry => {
    const date = parseISO(entry.date)
    return {
      entry,
      date,
      x: dayX(window, date),
      y: entry.grams / GRAMS_PER_KG
    }
  })
  const visible = points.filter(
    p => p.x > 0 && p.x < days
  )
  const before = points.findLast(p => p.x < 0)
  const after = points.find(p => p.x > days)
  return {
    visible,
    curve: [
      ...(before ? [before] : []),
      ...visible,
      ...(after ? [after] : [])
    ]
  }
}

/**
 * The y axis, in kg: the values' range rounded out to
 * 10 kg, at least 20 kg wide. A 10 kg range grows on
 * the side nearer the values.
 */
export const yDomain = (
  values: readonly number[]
): readonly [number, number] => {
  if (values.length === 0) return EMPTY_Y_DOMAIN
  const min = Math.min(...values)
  const max = Math.max(...values)
  let low = Math.floor(min / Y_STEP) * Y_STEP
  let high = Math.ceil(max / Y_STEP) * Y_STEP
  if (high === low) {
    low -= Y_STEP
    high += Y_STEP
  } else if (high - low < MIN_Y_SPAN) {
    if (min - low <= high - max) low -= Y_STEP
    else high += Y_STEP
  }
  return [low, high]
}

/** A label every 10 kg, from the bottom up. */
export const yTicks = (
  [low, high]: readonly [number, number]
): number[] =>
  Array.from(
    { length: (high - low) / Y_STEP + 1 },
    (_, i) => low + i * Y_STEP
  )

/** Index of the point nearest `x`; -1 when none. */
export const nearestIndex = (
  points: readonly Point[],
  x: number
): number =>
  points.reduce(
    (best, p, i) =>
      best < 0
      || Math.abs(p.x - x) < Math.abs(points[best].x - x)
        ? i
        : best,
    -1
  )

// Tangents as d3's curveMonotoneX computes them
// (Steffen's method), so `curveAt` follows the drawn
// curve exactly.
const sign = (n: number): number => (n < 0 ? -1 : 1)

const innerSlope = (
  a: Point,
  b: Point,
  c: Point
): number => {
  const h0 = b.x - a.x
  const h1 = c.x - b.x
  const s0 = (b.y - a.y) / h0
  const s1 = (c.y - b.y) / h1
  const p = (s0 * h1 + s1 * h0) / (h0 + h1)
  return (sign(s0) + sign(s1))
    * Math.min(Math.abs(s0), Math.abs(s1), Math.abs(p) / 2)
    || 0
}

const endSlope = (
  a: Point,
  b: Point,
  t: number
): number =>
  (3 * (b.y - a.y) / (b.x - a.x) - t) / 2

const tangents = (points: readonly Point[]): number[] => {
  const n = points.length
  if (n === 2) {
    const [a, b] = points
    const slope = (b.y - a.y) / (b.x - a.x)
    return [slope, slope]
  }
  const t = points.map((p, i) =>
    i > 0 && i < n - 1
      ? innerSlope(points[i - 1], p, points[i + 1])
      : 0
  )
  t[0] = endSlope(points[0], points[1], t[1])
  t[n - 1] = endSlope(points[n - 2], points[n - 1], t[n - 2])
  return t
}

/**
 * The monotone curve's y at `x`, or `undefined` outside
 * the points' span (where nothing is drawn).
 */
export const curveAt = (
  points: readonly Point[],
  x: number
): number | undefined => {
  const n = points.length
  if (n === 0 || x < points[0].x || x > points[n - 1].x)
    return undefined
  if (n === 1) return points[0].y
  // The segment from points[i] to points[i + 1].
  const next = points.findIndex(p => p.x > x)
  const i = next < 0 ? n - 2 : next - 1
  const [a, b] = [points[i], points[i + 1]]
  const t = tangents(points)
  const [ta, tb] = [t[i], t[i + 1]]
  // Cubic Hermite, equal to d3's Bézier segment.
  const h = b.x - a.x
  const s = (x - a.x) / h
  const s2 = s * s
  const s3 = s2 * s
  return (2 * s3 - 3 * s2 + 1) * a.y
    + (s3 - 2 * s2 + s) * h * ta
    + (-2 * s3 + 3 * s2) * b.y
    + (s3 - s2) * h * tb
}
