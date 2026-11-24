/**
 * Sleep Quality's month view: each step's Day Pill
 * opacity, and the month-to-date average.
 */
import { startOfMonth } from 'date-fns'
import { localDate } from '@shared/dates'
import type {
  SleepQualityEntry,
  SleepQualityRating
} from '@shared/sleep-quality'

/**
 * Figma's Sleep / Quality ramp: one white Day Pill,
 * dim for Poor (1) up to full for Great (5).
 */
export const QUALITY_OPACITY = {
  1: 0.18,
  2: 0.35,
  3: 0.55,
  4: 0.78,
  5: 1
} as const satisfies Record<SleepQualityRating, number>

/**
 * The mean rating of `day`'s month up to `day`, the
 * month-to-date window; null without any rating there.
 */
export const averageQuality = (
  entries: readonly SleepQualityEntry[],
  day: Date
): number | null => {
  const from = localDate(startOfMonth(day))
  const to = localDate(day)
  const ratings = entries
    .filter(entry => entry.date >= from && entry.date <= to)
    .map(entry => entry.rating)
  if (ratings.length === 0) return null
  const sum = ratings.reduce<number>((a, b) => a + b, 0)
  return sum / ratings.length
}
