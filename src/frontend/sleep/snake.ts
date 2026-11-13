/**
 * The Sleep Timeline's geometry as Figma's snake (ADR
 * 0003), free of rendering: one continuous line with two
 * rows per day. Day `i` (counted from `first`) has:
 *
 * - its left curve, 0:00 to 1:00, from the day before's
 *   PM row down to its AM row, bulging left;
 * - its AM row, 1:00 to 12:00, left to right;
 * - its right curve, 12:00 to 13:00, bulging right;
 * - its PM row, 13:00 to 24:00, right to left.
 *
 * Rows hold 11 hours and curves one, so an hour is a
 * row's length divided by 11, at any width. Segment ends
 * sit on the local clock, so a DST day stretches or
 * squeezes the segment its change falls in.
 */
import {
  addDays,
  differenceInCalendarDays,
  startOfDay
} from 'date-fns'
import type { EpochMs, SleepPeriod } from '@shared/sleep'

/** Where the snake sits, in pixels. */
export interface SnakeLayout {
  /** The x of the rows' left ends (1:00 and 24:00). */
  readonly left: number
  /** The x of the rows' right ends (12:00 and 13:00). */
  readonly right: number
  /** The y of the first day's AM row. */
  readonly top: number
  /**
   * From an AM row to its PM row, and so a curve's
   * diameter. A day is two gaps tall.
   */
  readonly gap: number
}

/**
 * Figma's Sleep frame: an AM row 28.5 px above its PM
 * row, so a day is 57 px tall.
 */
export const ROW_GAP = 28.5
/** Room above the first day's AM row. */
export const SNAKE_TOP = 23
/** From each curve's outer edge to the snake's side. */
export const SNAKE_EDGE = 10

/** The layout of a snake `width` px wide. */
export const snakeLayout = (width: number): SnakeLayout => ({
  left: SNAKE_EDGE + ROW_GAP / 2,
  right: width - SNAKE_EDGE - ROW_GAP / 2,
  top: SNAKE_TOP,
  gap: ROW_GAP
})

export interface Point {
  readonly x: number
  readonly y: number
}

type Kind = 'left' | 'am' | 'right' | 'pm'

/** One stretch of the snake within a day. */
interface Segment {
  readonly kind: Kind
  /** The day's index from `first`. */
  readonly day: number
  readonly from: EpochMs
  readonly to: EpochMs
}

/** `hour` o'clock, local time, on `day`. */
const clock = (day: Date, hour: number): EpochMs =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hour
  ).getTime()

/** Day `index`'s four segments, in time order. */
const segmentsOfDay = (
  first: Date,
  index: number
): Segment[] => {
  const day = addDays(startOfDay(first), index)
  const [h0, h1, h12, h13, h24] = [0, 1, 12, 13, 24]
    .map(hour => clock(day, hour))
  return [
    { kind: 'left', day: index, from: h0, to: h1 },
    { kind: 'am', day: index, from: h1, to: h12 },
    { kind: 'right', day: index, from: h12, to: h13 },
    { kind: 'pm', day: index, from: h13, to: h24 }
  ]
}

/** The day index of `time`, from `first`. */
const dayIndex = (first: Date, time: EpochMs): number =>
  differenceInCalendarDays(new Date(time), first)

/** The segment holding `time`; 24:00 is the next day's 0:00. */
const segmentAt = (first: Date, time: EpochMs): Segment =>
  segmentsOfDay(first, dayIndex(first, time))
    .find(s => time >= s.from && time < s.to)
    ?? segmentsOfDay(first, dayIndex(first, time))[0]

/** Day `index`'s AM row y. */
const amY = (layout: SnakeLayout, index: number): number =>
  layout.top + 2 * layout.gap * index

/** Where a fraction `f` of `segment` lies. */
const pointOn = (
  segment: Segment,
  f: number,
  layout: SnakeLayout
): Point => {
  const { left, right, gap } = layout
  const r = gap / 2
  const y = amY(layout, segment.day)
  switch (segment.kind) {
    case 'am':
      return { x: left + f * (right - left), y }
    case 'pm':
      return { x: right - f * (right - left), y: y + gap }
    case 'right': {
      // Top to bottom, clockwise round the right edge.
      const angle = -Math.PI / 2 + Math.PI * f
      return {
        x: right + r * Math.cos(angle),
        y: y + r + r * Math.sin(angle)
      }
    }
    case 'left': {
      // Top to bottom, anticlockwise round the left edge.
      const angle = -Math.PI / 2 - Math.PI * f
      return {
        x: left + r * Math.cos(angle),
        y: y - r + r * Math.sin(angle)
      }
    }
  }
}

const fractionOf = (
  segment: Segment,
  time: EpochMs
): number =>
  (time - segment.from) / (segment.to - segment.from)

/** `time`'s point on the snake drawn from `first`. */
export const pointAt = (
  time: EpochMs,
  first: Date,
  layout: SnakeLayout
): Point => {
  const segment = segmentAt(first, time)
  return pointOn(segment, fractionOf(segment, time), layout)
}

const clamp = (value: number): number =>
  Math.min(1, Math.max(0, value))

/** The fraction of `segment` nearest `point`. */
const nearestOn = (
  segment: Segment,
  point: Point,
  layout: SnakeLayout
): number => {
  const { left, right, gap } = layout
  const r = gap / 2
  const y = amY(layout, segment.day)
  switch (segment.kind) {
    case 'am':
      return clamp((point.x - left) / (right - left))
    case 'pm':
      return clamp((right - point.x) / (right - left))
    case 'right': {
      const angle = Math.atan2(point.y - (y + r), point.x - right)
      return clamp((angle + Math.PI / 2) / Math.PI)
    }
    case 'left': {
      // Angles measured anticlockwise from the top.
      const angle = Math.atan2(point.y - (y - r), point.x - left)
      const fromTop = -Math.PI / 2 - angle
      const wrapped = fromTop < 0 ? fromTop + 2 * Math.PI : fromTop
      return clamp(wrapped / Math.PI)
    }
  }
}

const distance = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y)

/**
 * The time on the snake nearest `point`, such as a
 * click, looking at the days around its height.
 */
export const timeAt = (
  point: Point,
  first: Date,
  layout: SnakeLayout
): EpochMs => {
  const near = Math.floor(
    (point.y - layout.top) / (2 * layout.gap)
  )
  let best = { time: 0, distance: Infinity }
  for (const index of [near - 1, near, near + 1, near + 2]) {
    for (const segment of segmentsOfDay(first, index)) {
      const f = nearestOn(segment, point, layout)
      const d = distance(pointOn(segment, f, layout), point)
      if (d < best.distance) {
        best = {
          time: segment.from + f * (segment.to - segment.from),
          distance: d
        }
      }
    }
  }
  return Math.round(best.time)
}

/** The SVG path data for `from` to `to` along the snake. */
export const stretchPath = (
  from: EpochMs,
  to: EpochMs,
  first: Date,
  layout: SnakeLayout
): string => {
  const r = layout.gap / 2
  const fmt = (n: number): string => String(+n.toFixed(2))
  const start = pointAt(from, first, layout)
  const parts = [`M ${fmt(start.x)} ${fmt(start.y)}`]
  const firstDay = dayIndex(first, from)
  const lastDay = dayIndex(first, to)
  for (let index = firstDay; index <= lastDay; index++) {
    for (const segment of segmentsOfDay(first, index)) {
      if (segment.to <= from || segment.from >= to) continue
      const end = pointOn(
        segment,
        fractionOf(segment, Math.min(to, segment.to)),
        layout
      )
      const xy = `${fmt(end.x)} ${fmt(end.y)}`
      if (segment.kind === 'am' || segment.kind === 'pm')
        parts.push(`L ${xy}`)
      else {
        // The right curve turns clockwise, the left
        // anticlockwise; neither passes half a turn.
        const sweep = segment.kind === 'right' ? 1 : 0
        parts.push(`A ${fmt(r)} ${fmt(r)} 0 0 ${sweep} ${xy}`)
      }
    }
  }
  return parts.join(' ')
}

/**
 * The leftmost and rightmost x from `from` to `to`
 * along the snake, to the nearest five minutes.
 */
export const stretchSpan = (
  from: EpochMs,
  to: EpochMs,
  first: Date,
  layout: SnakeLayout
): { left: number; right: number } => {
  const step = 5 * 60_000
  let left = Infinity
  let right = -Infinity
  for (
    let time = from;
    ;
    time = Math.min(to, time + step)
  ) {
    const { x } = pointAt(time, first, layout)
    left = Math.min(left, x)
    right = Math.max(right, x)
    if (time >= to) return { left, right }
  }
}

/** A Period's stretch of the snake, Head to Tail. */
export const periodPath = (
  period: SleepPeriod,
  first: Date,
  layout: SnakeLayout
): string =>
  stretchPath(period.start, period.end, first, layout)

/**
 * The whole snake for `days` days from `first`: from
 * the first day's 1:00 to midnight after the last.
 */
export const snakePath = (
  first: Date,
  days: number,
  layout: SnakeLayout
): string => {
  const day = startOfDay(first)
  return stretchPath(
    clock(day, 1),
    clock(addDays(day, days), 0),
    first,
    layout
  )
}
