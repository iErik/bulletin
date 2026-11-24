import { describe, expect, it } from 'vitest'
import {
  SLEEP_QUALITY_STEPS,
  type SleepQualityEntry,
  type SleepQualityRating
} from '@shared/sleep-quality'
import { QUALITY_OPACITY, averageQuality } from './quality'

const rated = (
  date: string,
  rating: SleepQualityRating
): SleepQualityEntry => ({ date, rating })

// Months are 0-based.
const DAY = new Date(2026, 10, 15)

describe('QUALITY_OPACITY', () => {
  it('brightens from Poor to Great', () => {
    expect(SLEEP_QUALITY_STEPS.map(step =>
      QUALITY_OPACITY[step.value]))
      .toEqual([0.18, 0.35, 0.55, 0.78, 1])
  })
})

describe('averageQuality', () => {
  it('is null without ratings', () => {
    expect(averageQuality([], DAY)).toBeNull()
  })

  it('averages the month’s ratings up to the day', () => {
    expect(averageQuality([
      rated('2026-11-01', 3),
      rated('2026-11-02', 4),
      rated('2026-11-15', 5)
    ], DAY)).toBe(4)
  })

  it('skips unrated days rather than counting 0', () => {
    expect(averageQuality([
      rated('2026-11-03', 2),
      rated('2026-11-10', 5)
    ], DAY)).toBe(3.5)
  })

  it('leaves out days after it and other months', () => {
    expect(averageQuality([
      rated('2026-10-31', 1),
      rated('2026-11-14', 4),
      rated('2026-11-16', 1),
      rated('2026-12-01', 1)
    ], DAY)).toBe(4)
  })

  it('is null when every rating is after the day', () => {
    expect(averageQuality(
      [rated('2026-11-20', 5)],
      DAY
    )).toBeNull()
  })
})
