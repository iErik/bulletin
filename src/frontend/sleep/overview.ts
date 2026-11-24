/** Sleep Overview maths. Ignores days after Selected Date. */
import {
  addDays,
  endOfWeek,
  parseISO,
  startOfWeek
} from 'date-fns'
import { localDate } from '@shared/dates'
import type { LocalDate } from '@shared/storage'
import { formatDuration } from './caption'
import type { SleepDay, Stretch } from './stretches'

const MINUTE_MS = 60_000
const CHART_NIGHTS = 14
export const CHART_SCALE_MIN_MS = 4 * 60 * MINUTE_MS
export const CHART_SCALE_MAX_MS = 12 * 60 * MINUTE_MS
export const CHART_BAR_STUB_PX = 4

export interface NightStat {
  readonly day: LocalDate
  readonly asleepMs: number
}

export interface NightBar {
  readonly day: LocalDate
  readonly asleepMs: number | null
  readonly meetsGoal: boolean
}

export interface NapsStat {
  readonly count: number
  readonly avgMs: number | null
}

type Days = readonly SleepDay[]
type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6

const shiftDay = (
  date: LocalDate,
  n: number
): LocalDate => localDate(addDays(parseISO(date), n))

const monthFrom = (date: LocalDate): LocalDate =>
  `${date.slice(0, 7)}-01`

const inRange = (
  day: LocalDate,
  from: LocalDate,
  to: LocalDate
): boolean => day >= from && day <= to

const nightMap = (
  days: Days,
  to: LocalDate
): Map<LocalDate, Stretch> => {
  const map = new Map<LocalDate, Stretch>()
  for (const { day, night } of days)
    if (night && day <= to) map.set(day, night)
  return map
}

const monthNights = (
  days: Days,
  date: LocalDate
): NightStat[] => {
  const from = monthFrom(date)
  const out: NightStat[] = []
  for (const { day, night } of days) {
    if (!night || !inRange(day, from, date)) continue
    out.push({ day, asleepMs: night.asleepMs })
  }
  return out
}

const mean = (
  values: readonly number[]
): number | null =>
  values.length === 0
    ? null
    : values.reduce((a, b) => a + b, 0) / values.length

export const avgSleepMs = (
  days: Days,
  date: LocalDate
): number | null =>
  mean(monthNights(days, date).map(n => n.asleepMs))

export const sleepDebtMs = (
  days: Days,
  date: LocalDate,
  goalMinutes: number
): number | null => {
  const from = shiftDay(date, 1 - CHART_NIGHTS)
  const goalMs = goalMinutes * MINUTE_MS
  let total = 0
  let count = 0
  for (const { day, night } of days) {
    if (!night || !inRange(day, from, date)) continue
    total += night.asleepMs - goalMs
    count += 1
  }
  return count === 0 ? null : total
}

export const streak = (
  days: Days,
  date: LocalDate,
  goalMinutes: number
): number => {
  const nights = nightMap(days, date)
  const goalMs = goalMinutes * MINUTE_MS
  let day = nights.has(date) ? date : shiftDay(date, -1)
  let count = 0
  while (true) {
    const night = nights.get(day)
    if (!night || night.asleepMs < goalMs) break
    count += 1
    day = shiftDay(day, -1)
  }
  return count
}

export const nightBars = (
  days: Days,
  date: LocalDate,
  goalMinutes: number
): NightBar[] => {
  const nights = nightMap(days, date)
  const goalMs = goalMinutes * MINUTE_MS
  const bars: NightBar[] = []
  for (let i = CHART_NIGHTS - 1; i >= 0; i--) {
    const day = shiftDay(date, -i)
    const night = nights.get(day)
    bars.push({
      day,
      asleepMs: night?.asleepMs ?? null,
      meetsGoal: !!night && night.asleepMs >= goalMs
    })
  }
  return bars
}

export const barHeightPx = (
  asleepMs: number,
  chartHeight: number
): number => {
  if (asleepMs < CHART_SCALE_MIN_MS) return CHART_BAR_STUB_PX
  const span = CHART_SCALE_MAX_MS - CHART_SCALE_MIN_MS
  const above = Math.min(asleepMs, CHART_SCALE_MAX_MS)
    - CHART_SCALE_MIN_MS
  return (above / span) * chartHeight
}

const pickExtreme = (
  nights: readonly NightStat[],
  prefer: 'longest' | 'shortest'
): NightStat | null => {
  let best: NightStat | null = null
  for (const night of nights) {
    if (!best) {
      best = night
      continue
    }
    const delta = night.asleepMs - best.asleepMs
    const better = prefer === 'longest'
      ? delta > 0
      : delta < 0
    if (better || (delta === 0 && night.day > best.day))
      best = night
  }
  return best
}

export const longestNight = (
  days: Days,
  date: LocalDate
): NightStat | null =>
  pickExtreme(monthNights(days, date), 'longest')

export const shortestNight = (
  days: Days,
  date: LocalDate
): NightStat | null =>
  pickExtreme(monthNights(days, date), 'shortest')

const weekBounds = (
  date: LocalDate,
  weekStartsOn: number
): { from: LocalDate; to: LocalDate } => {
  const opts = {
    weekStartsOn: (
      ((weekStartsOn % 7) + 7) % 7
    ) as WeekStart
  }
  const day = parseISO(date)
  return {
    from: localDate(startOfWeek(day, opts)),
    to: localDate(endOfWeek(day, opts))
  }
}

export const naps = (
  days: Days,
  date: LocalDate,
  weekStartsOn: number
): NapsStat => {
  const { from, to: weekEnd } = weekBounds(
    date,
    weekStartsOn
  )
  const to = weekEnd < date ? weekEnd : date
  const lengths: number[] = []
  for (const { day, naps: dayNaps } of days) {
    if (!inRange(day, from, to)) continue
    for (const nap of dayNaps) lengths.push(nap.asleepMs)
  }
  return { count: lengths.length, avgMs: mean(lengths) }
}

export const wakeUpsPerNight = (
  days: Days,
  date: LocalDate
): number | null => {
  const from = monthFrom(date)
  const counts: number[] = []
  for (const { day, night } of days) {
    if (!night || !inRange(day, from, date)) continue
    counts.push(night.wakeUps)
  }
  return mean(counts)
}

export const formatSleepDuration = formatDuration

/** Signed debt with Unicode minus: "−2h 00m". */
export const formatSleepDebt = (ms: number): string =>
  `${ms < 0 ? '−' : '+'}${formatDuration(Math.abs(ms))}`

export const formatNapAvg = (ms: number): string => {
  const minutes = Math.round(ms / MINUTE_MS)
  if (minutes < 60) return `avg ${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = String(minutes % 60).padStart(2, '0')
  return `avg ${h}h ${m}m`
}

export const formatGoalLabel = (
  minutes: number
): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}h goal`
  return `${h}h ${String(m).padStart(2, '0')}m goal`
}
