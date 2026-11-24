/**
 * Pure calculations for the Mood Overview Widget: tiles,
 * Mood mix and Patterns rows. Entries after the Selected
 * Date are always ignored.
 */
import {
  addDays,
  differenceInCalendarDays,
  getDay,
  parseISO
} from 'date-fns'
import { localDate, sameSpanLastMonth } from '@shared/dates'
import {
  MOODS,
  isGoodMood,
  isHardMood,
  type MoodEntry,
  type MoodKey
} from '@shared/mood'
import type { DateRange, LocalDate } from '@shared/storage'

type Entries = readonly MoodEntry[]

export interface MostCommonMood {
  readonly mood: MoodKey
  readonly count: number
  readonly share: number
}

export interface LoggedProgress {
  readonly logged: number
  readonly total: number
  readonly share: number
}

export interface MoodMixSegment {
  readonly mood: MoodKey
  readonly count: number
  readonly share: number
  readonly showPercent: boolean
}

export interface MoodMixBar {
  readonly range: DateRange
  readonly total: number
  readonly segments: readonly MoodMixSegment[]
}

export interface MoodMix {
  readonly current: MoodMixBar
  readonly previous: MoodMixBar
}

/** 0 is Sunday, 1 Monday, ..., 6 Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface WeekdayMood {
  readonly weekday: Weekday
  readonly mood: MoodKey
  readonly share: number
}

export interface StressedDays {
  readonly count: number
  readonly previous: number
  readonly delta: number
}

export interface AnxiousRun extends DateRange {
  readonly days: number
}

export interface MostImprovedMood {
  readonly mood: MoodKey
  /** Signed share change: >0 Good up, <0 Hard down. */
  readonly delta: number
  readonly comparedTo: DateRange
}

const shiftDay = (date: LocalDate, days: number): LocalDate =>
  localDate(addDays(parseISO(date), days))

const ytdRange = (date: LocalDate): DateRange =>
  ({ from: `${date.slice(0, 4)}-01-01`, to: date })

const monthRange = (date: LocalDate): DateRange =>
  ({ from: `${date.slice(0, 7)}-01`, to: date })

/** The 90 days ending on `date`. */
export const last90Range = (date: LocalDate): DateRange =>
  ({ from: shiftDay(date, -89), to: date })

const byDateInRange = (
  entries: Entries,
  range: DateRange
): Map<LocalDate, MoodKey> => {
  const map = new Map<LocalDate, MoodKey>()
  for (const { date, mood } of entries)
    if (date >= range.from && date <= range.to) map.set(date, mood)
  return map
}

const spanCounts = (
  entries: Entries,
  range: DateRange
): { total: number; counts: Map<MoodKey, number> } => {
  const byDate = byDateInRange(entries, range)
  const counts = new Map<MoodKey, number>()
  for (const mood of byDate.values())
    counts.set(mood, (counts.get(mood) ?? 0) + 1)
  return { total: byDate.size, counts }
}

/**
 * Turns a fraction into a whole percentage by rounding
 * toward zero (flooring non-negative shares). Epsilon
 * avoids IEEE-754 under-flooring exact decimals.
 */
export const wholePercent = (fraction: number): number => {
  const scaled = fraction * 100
  return Math.trunc(scaled + Math.sign(scaled) * 1e-9) || 0
}

/** Most frequent YTD Mood; ties go to `MOODS` order. */
export const mostCommon = (
  entries: Entries,
  date: LocalDate
): MostCommonMood | null => {
  const { total, counts } = spanCounts(entries, ytdRange(date))
  if (total === 0) return null
  let mood: MoodKey = MOODS[0].key
  let count = 0
  for (const { key } of MOODS) {
    const n = counts.get(key) ?? 0
    if (n > count) {
      mood = key
      count = n
    }
  }
  return { mood, count, share: count / total }
}

/**
 * Uncapped consecutive Good Mood days back from `date`,
 * or yesterday if `date` has no Mood yet.
 */
export const goodStreak = (entries: Entries, date: LocalDate): number => {
  const byDate = new Map<LocalDate, MoodKey>()
  for (const entry of entries)
    if (entry.date <= date) byDate.set(entry.date, entry.mood)
  let day = byDate.has(date) ? date : shiftDay(date, -1)
  let streak = 0
  while (true) {
    const mood = byDate.get(day)
    if (!mood || !isGoodMood(mood)) break
    streak += 1
    day = shiftDay(day, -1)
  }
  return streak
}

/** Days with a Mood YTD out of elapsed calendar days. */
export const logged = (entries: Entries, date: LocalDate): LoggedProgress => {
  const range = ytdRange(date)
  const count = byDateInRange(entries, range).size
  const total =
    differenceInCalendarDays(parseISO(date), parseISO(range.from)) + 1
  return { logged: count, total, share: count / total }
}

const mixBar = (entries: Entries, range: DateRange): MoodMixBar => {
  const { total, counts } = spanCounts(entries, range)
  if (total === 0) return { range, total: 0, segments: [] }
  const segments: MoodMixSegment[] = []
  for (const { key } of MOODS) {
    const count = counts.get(key) ?? 0
    if (count === 0) continue
    const share = count / total
    segments.push({
      mood: key, count, share, showPercent: wholePercent(share) >= 10
    })
  }
  return { range, total, segments }
}

/** This month vs same span last month, in `MOODS` order. */
export const moodMix = (entries: Entries, date: LocalDate): MoodMix => ({
  current: mixBar(entries, monthRange(date)),
  previous: mixBar(entries, sameSpanLastMonth(date))
})

const topWeekdayMood = (
  entries: Entries,
  date: LocalDate,
  moods: readonly MoodKey[],
  weekStartsOn: number
): WeekdayMood | null => {
  const byDate = byDateInRange(entries, last90Range(date))
  const totals = new Array<number>(7).fill(0)
  const counts = Array.from({ length: 7 }, () => new Map<MoodKey, number>())
  for (const [dayDate, mood] of byDate) {
    const day = getDay(parseISO(dayDate))
    totals[day] += 1
    counts[day].set(mood, (counts[day].get(mood) ?? 0) + 1)
  }
  const start = ((weekStartsOn % 7) + 7) % 7
  let best: WeekdayMood | null = null
  let bestCount = 0
  let bestTotal = 1
  for (let i = 0; i < 7; i++) {
    const weekday = ((start + i) % 7) as Weekday
    const total = totals[weekday]
    if (total === 0) continue
    for (const mood of moods) {
      const count = counts[weekday].get(mood) ?? 0
      if (count > 0 && count * bestTotal > bestCount * total) {
        best = { weekday, mood, share: count / total }
        bestCount = count
        bestTotal = total
      }
    }
  }
  return best
}

/** Highest Happy share by weekday over the last 90 days. */
export const bestWeekday = (
  entries: Entries,
  date: LocalDate,
  weekStartsOn: number
): WeekdayMood | null =>
  topWeekdayMood(entries, date, ['happy'], weekStartsOn)

/** Highest Hard Mood share by weekday over last 90 days. */
export const toughestWeekday = (
  entries: Entries,
  date: LocalDate,
  weekStartsOn: number
): WeekdayMood | null => topWeekdayMood(
  entries, date, MOODS.filter(isHardMood).map(m => m.key), weekStartsOn
)

/** Stressed days this month vs the same span last month. */
export const stressedDays = (
  entries: Entries,
  date: LocalDate
): StressedDays | null => {
  const current = spanCounts(entries, monthRange(date))
  if (current.total === 0) return null
  const previous = spanCounts(entries, sameSpanLastMonth(date))
  const count = current.counts.get('stressed') ?? 0
  const prev = previous.counts.get('stressed') ?? 0
  return { count, previous: prev, delta: count - prev }
}

/** Longest run of 2+ Anxious days in the last 90 days. */
export const longestAnxiousRun = (
  entries: Entries,
  date: LocalDate
): AnxiousRun | null => {
  const range = last90Range(date)
  const byDate = byDateInRange(entries, range)
  let best: AnxiousRun | null = null
  let start: LocalDate | null = null
  let days = 0
  for (let day = range.from; day <= range.to; day = shiftDay(day, 1)) {
    if (byDate.get(day) === 'anxious') {
      if (start === null) start = day
      days += 1
      if (days >= 2 && (best === null || days >= best.days))
        best = { from: start, to: day, days }
    } else {
      start = null
      days = 0
    }
  }
  return best
}

/** Mood moving most in a good direction vs last month. */
export const mostImproved = (
  entries: Entries,
  date: LocalDate
): MostImprovedMood | null => {
  const current = spanCounts(entries, monthRange(date))
  const comparedTo = sameSpanLastMonth(date)
  const previous = spanCounts(entries, comparedTo)
  if (current.total === 0 || previous.total === 0) return null
  let best: MostImprovedMood | null = null
  let bestScore = 0
  for (const mood of MOODS) {
    const sign = isGoodMood(mood) ? 1 : isHardMood(mood) ? -1 : 0
    if (sign === 0) continue
    const curr = current.counts.get(mood.key) ?? 0
    const prev = previous.counts.get(mood.key) ?? 0
    const score = sign * (curr * previous.total - prev * current.total)
    if (score > bestScore) {
      bestScore = score
      best = {
        mood: mood.key,
        delta: curr / current.total - prev / previous.total,
        comparedTo
      }
    }
  }
  return best && wholePercent(best.delta) !== 0 ? best : null
}
