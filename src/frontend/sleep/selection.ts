/**
 * The rules for creating a sleep Period on the
 * Timeline, free of rendering: snapping, ordering the
 * two clicks, and the checks storage also makes, so the
 * preview can refuse a Period before it's saved.
 */
import type {
  EpochMs,
  NewSleepPeriod,
  SleepPeriod
} from '@shared/sleep'
import type { StorageErrorCode } from '@shared/storage'

const MINUTE = 60_000
/** The longest Period, as storage allows. */
const MAX_PERIOD = 24 * 60 * MINUTE

/**
 * `time` to the nearest `minutes`. Epoch time and local
 * time differ by whole hours (or 30 or 45 minutes), so
 * this snaps on the local clock too.
 */
export const snap = (
  time: EpochMs,
  minutes = 5
): EpochMs => {
  const step = minutes * MINUTE
  return Math.round(time / step) * step
}

/** The Period between two clicks, in either order. */
export const ordered = (
  a: EpochMs,
  b: EpochMs
): NewSleepPeriod => ({
  start: Math.min(a, b),
  end: Math.max(a, b)
})

/** The Period containing `time`, if any. */
export const periodAt = (
  periods: readonly SleepPeriod[],
  time: EpochMs
): SleepPeriod | undefined =>
  periods.find(p => p.start < time && time < p.end)

/** A rule a new Period can break. */
export type PeriodRule = Extract<
  StorageErrorCode,
  | 'reversed-period'
  | 'period-too-long'
  | 'future-date'
  | 'overlapping-period'
>

/**
 * The first rule `period` breaks, or null. Periods
 * may touch end to start, as in storage.
 */
export const breaks = (
  { start, end }: NewSleepPeriod,
  periods: readonly SleepPeriod[],
  now: EpochMs
): PeriodRule | null => {
  if (end <= start) return 'reversed-period'
  if (end - start > MAX_PERIOD) return 'period-too-long'
  if (end > now) return 'future-date'
  if (periods.some(p => p.start < end && p.end > start))
    return 'overlapping-period'
  return null
}

const REASONS: Record<PeriodRule, string> = {
  'reversed-period': 'It ends where it starts',
  'period-too-long': "It's over 24 hours",
  'future-date': 'It ends in the future',
  'overlapping-period': 'It overlaps another period'
}

/** Why a Period can't be saved, in a few words. */
export const reason = (code: StorageErrorCode): string =>
  code in REASONS
    ? REASONS[code as PeriodRule]
    : 'Something went wrong'
