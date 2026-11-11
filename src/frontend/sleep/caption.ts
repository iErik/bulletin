import type { SleepPeriod } from '@shared/sleep'
import { formatTime } from '@/locale/format'

const MINUTE = 60_000

/** A duration as "8h 05m". */
export const formatDuration = (ms: number): string => {
  const minutes = Math.round(ms / MINUTE)
  const h = Math.floor(minutes / 60)
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}h ${m}m`
}

/**
 * The caption under a day's label, from the Periods
 * whose Head is in its row: one Period's start and
 * end, the total and count of several, or nothing.
 */
export const caption = (
  periods: readonly SleepPeriod[]
): string => {
  if (periods.length === 0) return ''
  if (periods.length === 1) {
    const [{ start, end }] = periods
    return `${formatTime(new Date(start))} to `
      + formatTime(new Date(end))
  }
  const total = periods.reduce(
    (sum, p) => sum + p.end - p.start,
    0
  )
  return `${formatDuration(total)} · `
    + `${periods.length} periods`
}
