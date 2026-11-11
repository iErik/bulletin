/**
 * The rules for creating and moving a sleep Period on
 * the Timeline, free of rendering: snapping, ordering
 * the two clicks, clamping a drag, and the checks
 * storage also makes, so the preview can refuse a
 * Period before it's saved.
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

const STEP = 5 * MINUTE

/**
 * `time` to the nearest 5 minutes. Epoch time and local
 * time differ by whole hours (or 30 or 45 minutes), so
 * this snaps on the local clock too.
 */
export const snap = (time: EpochMs): EpochMs =>
  Math.round(time / STEP) * STEP

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

/** The end of a Period a drag moves. */
export type End = 'start' | 'end'

/**
 * `period` with its `end` dragged to `time`: snapped,
 * then held between the other end and the neighbouring
 * Periods, within 24 hours, and never past `now`.
 */
export const drag = (
  period: SleepPeriod,
  end: End,
  time: EpochMs,
  periods: readonly SleepPeriod[],
  now: EpochMs
): SleepPeriod => {
  const others = periods.filter(p => p.id !== period.id)
  const to = snap(time)
  if (end === 'start') {
    const low = Math.max(
      period.end - MAX_PERIOD,
      ...others
        .filter(p => p.end <= period.start)
        .map(p => p.end)
    )
    const start = Math.min(
      period.end - STEP,
      Math.max(low, to)
    )
    return { ...period, start }
  }
  const high = Math.min(
    period.start + MAX_PERIOD,
    Math.floor(now / STEP) * STEP,
    ...others
      .filter(p => p.start >= period.end)
      .map(p => p.start)
  )
  const stop = Math.max(
    period.start + STEP,
    Math.min(high, to)
  )
  return { ...period, end: stop }
}

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
