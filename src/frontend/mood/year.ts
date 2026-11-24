/**
 * Pure calculations for the Year in Mood Widget: the
 * Selected Date's year, Jan 1 to the Selected Date.
 * Entries outside that span are always ignored.
 */
import {
  MOOD_DISPLAY_ORDER,
  type MoodEntry,
  type MoodKey
} from '@shared/mood'
import type { LocalDate } from '@shared/storage'
import { logged } from './overview'

export interface MonthMixSegment {
  readonly mood: MoodKey
  readonly count: number
  /** Of the month's logged days. */
  readonly share: number
}

export interface YearMonth {
  /** 0 is January, 11 December. */
  readonly month: number
  /** Days with a Mood, up to the Selected Date. */
  readonly logged: number
  /** Happy's share of them; null with none logged. */
  readonly happyShare: number | null
  /** In `MOOD_DISPLAY_ORDER`, without empty Moods. */
  readonly mix: readonly MonthMixSegment[]
}

export interface YearInMood {
  readonly year: number
  /** Days with a Mood, Jan 1 to the Selected Date. */
  readonly logged: number
  /** Days from Jan 1 to the Selected Date. */
  readonly elapsed: number
  /** January to December. */
  readonly months: readonly YearMonth[]
}

const yearMonth = (
  month: number,
  counts: ReadonlyMap<MoodKey, number>
): YearMonth => {
  let total = 0
  for (const count of counts.values()) total += count
  const mix: MonthMixSegment[] = []
  for (const key of MOOD_DISPLAY_ORDER) {
    const count = counts.get(key) ?? 0
    if (count > 0)
      mix.push({ mood: key, count, share: count / total })
  }
  return {
    month,
    logged: total,
    happyShare: total === 0
      ? null
      : (counts.get('happy') ?? 0) / total,
    mix
  }
}

/** The header counts and each month's figures. */
export const yearInMood = (
  entries: readonly MoodEntry[],
  date: LocalDate
): YearInMood => {
  const from = `${date.slice(0, 4)}-01-01`
  // The last Entry for a day wins, as in storage.
  const byDate = new Map<LocalDate, MoodKey>()
  for (const entry of entries) {
    if (entry.date >= from && entry.date <= date)
      byDate.set(entry.date, entry.mood)
  }

  const counts = Array.from(
    { length: 12 },
    () => new Map<MoodKey, number>()
  )
  for (const [day, mood] of byDate) {
    const month = counts[Number(day.slice(5, 7)) - 1]
    month.set(mood, (month.get(mood) ?? 0) + 1)
  }

  const header = logged(entries, date)
  return {
    year: Number(date.slice(0, 4)),
    logged: header.logged,
    elapsed: header.total,
    months: counts.map((c, month) => yearMonth(month, c))
  }
}
