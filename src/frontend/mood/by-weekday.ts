/**
 * The pure calculation behind the Mood By Weekday
 * Widget: each weekday's Mood shares over the 90 days
 * ending on the Selected Date, and its best weekday.
 * Entries after the Selected Date are ignored.
 */
import { getDay, parseISO } from 'date-fns'
import {
  MOOD_DISPLAY_ORDER,
  type MoodEntry,
  type MoodKey
} from '@shared/mood'
import type { LocalDate } from '@shared/storage'
import {
  bestWeekday,
  last90Range,
  type Weekday
} from './overview'

/** One Mood's part of a weekday's bar. */
export interface WeekdaySegment {
  readonly mood: MoodKey
  readonly count: number
  /** Its days ÷ the weekday's logged days. */
  readonly share: number
}

/** One weekday's bar. */
export interface WeekdayColumn {
  readonly weekday: Weekday
  /** Days with a Mood on this weekday in the window. */
  readonly total: number
  /**
   * In `MOOD_DISPLAY_ORDER`, bottom to top, leaving out
   * Moods with no days. Empty when `total` is 0.
   */
  readonly segments: readonly WeekdaySegment[]
}

export interface MoodByWeekday {
  /** Seven, starting on `weekStartsOn`. */
  readonly columns: readonly WeekdayColumn[]
  /** The Overview's Best weekday, if there is one. */
  readonly best: Weekday | null
  /** Days with a Mood in the window. */
  readonly total: number
}

/**
 * Each weekday's Mood shares over the 90 days ending on
 * `date`, its columns starting on `weekStartsOn` (0 is
 * Sunday). `best` is `bestWeekday`'s, so it always
 * agrees with the Overview.
 */
export const moodByWeekday = (
  entries: readonly MoodEntry[],
  date: LocalDate,
  weekStartsOn: number
): MoodByWeekday => {
  const range = last90Range(date)
  const byDate = new Map<LocalDate, MoodKey>()
  for (const entry of entries) {
    if (entry.date >= range.from && entry.date <= range.to)
      byDate.set(entry.date, entry.mood)
  }
  const counts = Array.from(
    { length: 7 },
    () => new Map<MoodKey, number>()
  )
  for (const [day, mood] of byDate) {
    const tally = counts[getDay(parseISO(day))]
    tally.set(mood, (tally.get(mood) ?? 0) + 1)
  }
  const start = ((weekStartsOn % 7) + 7) % 7
  const columns = Array.from({ length: 7 }, (_, i) => {
    const weekday = ((start + i) % 7) as Weekday
    const tally = counts[weekday]
    let total = 0
    for (const n of tally.values()) total += n
    const segments = MOOD_DISPLAY_ORDER
      .filter(mood => tally.has(mood))
      .map(mood => {
        const count = tally.get(mood)!
        return { mood, count, share: count / total }
      })
    return { weekday, total, segments }
  })
  return {
    columns,
    best: bestWeekday(entries, date, weekStartsOn)?.weekday
      ?? null,
    total: byDate.size
  }
}
