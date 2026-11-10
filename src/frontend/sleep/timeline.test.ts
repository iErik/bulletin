import { describe, expect, it } from 'vitest'
import type { SleepPeriod } from '@shared/sleep'
import {
  axisTicks,
  dayKey,
  rowEnd,
  rowOf,
  rowStart,
  segmentsOf,
  toFraction,
  toTime
} from './timeline'

/** November `day`, 2026, at `h:m` local time. */
const at = (day: number, h: number, m = 0): number =>
  new Date(2026, 10, day, h, m).getTime()

const nov = (day: number): Date => new Date(2026, 10, day)

const period = (
  id: number,
  start: number,
  end: number
): SleepPeriod => ({ id, start, end })

describe('timeline', () => {
  it('runs a row from noon to noon the next day', () => {
    expect(rowStart(nov(7))).toBe(at(7, 12))
    expect(rowEnd(nov(7))).toBe(at(8, 12))
  })

  it.each([
    [at(8, 1), '2026-11-07'],
    [at(8, 11, 59), '2026-11-07'],
    [at(8, 12), '2026-11-08'],
    [at(7, 23), '2026-11-07']
  ])('puts %i in row %s', (time, key) => {
    expect(dayKey(rowOf(time))).toBe(key)
  })

  it('maps times to fractions of a row and back', () => {
    expect(toFraction(at(7, 12), nov(7))).toBe(0)
    expect(toFraction(at(8, 0), nov(7))).toBe(0.5)
    expect(toFraction(at(8, 12), nov(7))).toBe(1)
    expect(toTime(0.25, nov(7))).toBe(at(7, 18))
  })

  it("draws a night inside its Head's row", () => {
    const night = period(1, at(8, 1), at(8, 9))

    expect(segmentsOf([night], nov(7))).toEqual([{
      period: night,
      from: 13 / 24,
      to: 21 / 24,
      head: true,
      tail: true
    }])
  })

  it('continues a Period past noon on the next row', () => {
    const long = period(1, at(8, 6), at(8, 15))

    expect(segmentsOf([long], nov(7))).toEqual([{
      period: long,
      from: 18 / 24,
      to: 1,
      head: true,
      tail: false
    }])
    expect(segmentsOf([long], nov(8))).toEqual([{
      period: long,
      from: 0,
      to: 3 / 24,
      head: false,
      tail: true
    }])
  })

  it('keeps a Tail on noon in its own row', () => {
    const toNoon = period(1, at(8, 2), at(8, 12))

    expect(segmentsOf([toNoon], nov(7))[0].tail)
      .toBe(true)
    expect(segmentsOf([toNoon], nov(8))).toEqual([])
  })

  it('leaves out Periods of other rows', () => {
    expect(segmentsOf(
      [period(1, at(5, 22), at(6, 6))],
      nov(7)
    )).toEqual([])
  })

  it('ticks every three hours from noon', () => {
    const ticks = axisTicks()

    expect(ticks.map(t => t.fraction)).toEqual(
      [0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => n / 8)
    )
    expect(new Date(ticks[0].time).getHours()).toBe(12)
    expect(new Date(ticks[4].time).getHours()).toBe(0)
  })
})
