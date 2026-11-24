import { describe, expect, it } from 'vitest'
import type { LocalDate } from '@shared/storage'
import {
  avgSleepMs,
  barHeightPx,
  CHART_BAR_STUB_PX,
  CHART_SCALE_MIN_MS,
  formatGoalLabel,
  formatNapAvg,
  formatSleepDebt,
  longestNight,
  naps,
  nightBars,
  shortestNight,
  sleepDebtMs,
  streak,
  wakeUpsPerNight
} from './overview'
import type { SleepDay, Stretch } from './stretches'

const HOUR = 3_600_000
const MIN = 60_000

const day = (
  date: LocalDate,
  asleepMs: number | null,
  extras: {
    wakeUps?: number
    naps?: readonly number[]
  } = {}
): SleepDay => {
  const night: Stretch | null = asleepMs === null
    ? null
    : {
        day: date,
        start: 0,
        end: asleepMs,
        asleepMs,
        periods: [],
        wakeUps: extras.wakeUps ?? 0
      }
  return {
    day: date,
    night,
    naps: (extras.naps ?? []).map((ms, i) => ({
      day: date,
      start: i,
      end: i + ms,
      asleepMs: ms,
      periods: [],
      wakeUps: 0
    }))
  }
}

describe('overview', () => {
  it('covers tiles, bars, rows and formatters', () => {
    expect(avgSleepMs([
      day('2026-02-28', 9 * HOUR),
      day('2026-03-01', 7 * HOUR),
      day('2026-03-02', null),
      day('2026-03-03', 9 * HOUR),
      day('2026-03-16', 10 * HOUR)
    ], '2026-03-15')).toBe(8 * HOUR)
    expect(avgSleepMs([], '2026-03-15')).toBeNull()

    // 7h, 9h, 6h vs 8h → −2h
    expect(sleepDebtMs([
      day('2026-03-13', 7 * HOUR),
      day('2026-03-14', 9 * HOUR),
      day('2026-03-15', 6 * HOUR)
    ], '2026-03-15', 8 * 60)).toBe(-2 * HOUR)
    expect(sleepDebtMs([], '2026-03-15', 8 * 60))
      .toBeNull()

    const streakDays = [
      day('2025-12-30', 8 * HOUR),
      day('2025-12-31', 8 * HOUR),
      day('2026-01-01', 8 * HOUR),
      day('2026-01-02', 8 * HOUR),
      day('2026-01-03', null),
      day('2026-01-04', 9 * HOUR)
    ]
    expect(streak(streakDays, '2026-01-03', 8 * 60))
      .toBe(4)
    expect(streak(streakDays, '2026-01-04', 8 * 60))
      .toBe(1)
    expect(streak([], '2026-01-02', 8 * 60)).toBe(0)

    const bars = nightBars([
      day('2026-03-14', 9 * HOUR),
      day('2026-03-15', 6 * HOUR)
    ], '2026-03-15', 8 * 60)
    expect(bars).toHaveLength(14)
    expect(bars[0].day).toBe('2026-03-02')
    expect(bars[12]).toMatchObject({
      day: '2026-03-14',
      asleepMs: 9 * HOUR,
      meetsGoal: true
    })
    expect(bars[13].meetsGoal).toBe(false)
    expect(barHeightPx(3 * HOUR, 100))
      .toBe(CHART_BAR_STUB_PX)
    expect(barHeightPx(CHART_SCALE_MIN_MS, 100)).toBe(0)
    expect(barHeightPx(8 * HOUR, 100)).toBe(50)

    const extremes = [
      day('2026-03-01', 9 * HOUR),
      day('2026-03-10', 5 * HOUR),
      day('2026-03-12', 9 * HOUR),
      day('2026-03-14', 5 * HOUR)
    ]
    expect(longestNight(extremes, '2026-03-15'))
      .toEqual({ day: '2026-03-12', asleepMs: 9 * HOUR })
    expect(shortestNight(extremes, '2026-03-15'))
      .toEqual({ day: '2026-03-14', asleepMs: 5 * HOUR })

    // 2026-03-15 is Sunday.
    const napDays = [
      day('2026-03-14', 8 * HOUR, { naps: [30 * MIN] }),
      day('2026-03-15', 8 * HOUR, {
        naps: [40 * MIN, 20 * MIN]
      }),
      day('2026-03-16', 8 * HOUR, { naps: [50 * MIN] })
    ]
    expect(naps(napDays, '2026-03-15', 0))
      .toEqual({ count: 2, avgMs: 30 * MIN })
    expect(naps(napDays, '2026-03-15', 1))
      .toEqual({ count: 3, avgMs: 30 * MIN })
    expect(naps([], '2026-03-15', 0))
      .toEqual({ count: 0, avgMs: null })

    expect(wakeUpsPerNight([
      day('2026-03-01', 8 * HOUR, { wakeUps: 1 }),
      day('2026-03-03', 7 * HOUR, { wakeUps: 2 })
    ], '2026-03-15')).toBe(1.5)

    expect(formatSleepDebt(-2 * HOUR)).toBe('−2h 00m')
    expect(formatSleepDebt(0)).toBe('+0h 00m')
    expect(formatNapAvg(35 * MIN)).toBe('avg 35m')
    expect(formatNapAvg(HOUR + 5 * MIN))
      .toBe('avg 1h 05m')
    expect(formatGoalLabel(8 * 60)).toBe('8h goal')
    expect(formatGoalLabel(7 * 60 + 30))
      .toBe('7h 30m goal')
  })
})
