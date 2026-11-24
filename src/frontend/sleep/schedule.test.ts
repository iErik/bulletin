import { describe, expect, it } from 'vitest'
import type { Stretch } from './stretches'
import {
  axisLabel,
  axisRatio,
  circularMean,
  nightSpan,
  placeOnAxis,
  scheduleAxis,
  scheduleStats,
  scheduleWeek
} from './schedule'

const at = (
  day: number,
  hour: number,
  minute = 0
): number =>
  new Date(2026, 10, day, hour, minute).getTime()

const stretch = (
  start: number,
  end: number,
  day = '2026-11-10'
): Stretch => ({
  day, start, end, asleepMs: end - start,
  periods: [{ id: start, start, end }], wakeUps: 0
})

describe('schedule', () => {
  it('averages across midnight with ±30 min', () => {
    expect(circularMean([23 * 60 + 30, 30]))
      .toBeCloseTo(0, 5)
    expect(circularMean(
      [22 * 60, 10 * 60], undefined, 22 * 60
    )).toBeCloseTo(4 * 60, 5)
    const stats = scheduleStats([
      stretch(at(9, 23, 30), at(10, 7), '2026-11-10'),
      stretch(at(11, 0, 30), at(11, 7, 30), '2026-11-11')
    ])
    expect(stats.averageBed).toBeCloseTo(0, 5)
    expect(stats.deviationMin).toBe(30)
    expect(scheduleStats([
      stretch(at(10, 23, 10), at(11, 7, 5))
    ]).deviationMin).toBe(0)
    expect(scheduleStats([]).deviationMin).toBeNull()
  })

  it('places 23:10–07:05 on 22–10 and widens', () => {
    const night = stretch(at(10, 23, 10), at(11, 7, 5))
    const axis = scheduleAxis([night])
    const span = placeOnAxis(night, axis)
    expect(axis).toMatchObject({ start: 22, end: 34 })
    expect(span.bed).toBeCloseTo(23 + 10 / 60, 5)
    expect(span.wake).toBeCloseTo(31 + 5 / 60, 5)
    expect(axisRatio(span.bed, axis))
      .toBeCloseTo((23 + 10 / 60 - 22) / 12, 5)
    expect(scheduleAxis([
      stretch(at(10, 14), at(10, 21))
    ])).toMatchObject({ start: 14, end: 34 })
    expect(scheduleAxis([
      stretch(at(10, 10, 30), at(10, 18))
    ])).toMatchObject({ start: 22, end: 42 })
    expect(scheduleAxis([
      stretch(at(10, 0), at(10, 23, 59))
    ]).end - scheduleAxis([
      stretch(at(10, 0), at(10, 23, 59))
    ]).start).toBeLessThanOrEqual(24)
    expect(nightSpan(stretch(at(10, 23), at(11, 1))))
      .toEqual({ bed: 23, wake: 25 })
    expect(axisLabel(24)).toBe('00')
    expect(axisLabel(34)).toBe('10')
  })

  it('orders Locale weeks and blanks later days', () => {
    const selected = new Date(2026, 10, 11)
    expect(scheduleWeek(selected, [], 1).map(d => d.day))
      .toEqual([
        '2026-11-09', '2026-11-10', '2026-11-11',
        '2026-11-12', '2026-11-13', '2026-11-14',
        '2026-11-15'
      ])
    expect(scheduleWeek(selected, [], 0)[0].day)
      .toBe('2026-11-08')
    const days = scheduleWeek(selected, [
      {
        day: '2026-11-11',
        night: stretch(at(10, 23), at(11, 7), '2026-11-11')
      },
      {
        day: '2026-11-12',
        night: stretch(at(11, 23), at(12, 7), '2026-11-12')
      }
    ], 1)
    expect(days.find(d => d.day === '2026-11-12')?.night)
      .toBeNull()
  })
})
