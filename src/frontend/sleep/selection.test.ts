import { describe, expect, it } from 'vitest'
import type { SleepPeriod } from '@shared/sleep'
import {
  breaks,
  ordered,
  periodAt,
  reason,
  snap
} from './selection'

/** November `day`, 2026, at `h:m` local time. */
const at = (day: number, h: number, m = 0): number =>
  new Date(2026, 10, day, h, m).getTime()

const now = at(9, 15, 30)

const periods: SleepPeriod[] = [
  { id: 1, start: at(8, 1), end: at(8, 9) }
]

describe('selection', () => {
  it('snaps to the nearest 5 minutes', () => {
    expect(snap(at(7, 23, 2))).toBe(at(7, 23))
    expect(snap(at(7, 23, 3))).toBe(at(7, 23, 5))
    expect(snap(at(7, 23, 57) + 40_000))
      .toBe(at(8, 0))
  })

  it('swaps clicks in reverse order', () => {
    expect(ordered(at(8, 7), at(7, 23)))
      .toEqual({ start: at(7, 23), end: at(8, 7) })
    expect(ordered(at(7, 23), at(8, 7)))
      .toEqual({ start: at(7, 23), end: at(8, 7) })
  })

  it('finds the Period around a time', () => {
    expect(periodAt(periods, at(8, 4))).toBe(periods[0])
    expect(periodAt(periods, at(8, 1))).toBeUndefined()
    expect(periodAt(periods, at(8, 9))).toBeUndefined()
  })

  it('accepts a Period that breaks no rule', () => {
    const period = { start: at(7, 22), end: at(8, 1) }

    expect(breaks(period, periods, now)).toBeNull()
  })

  it.each([
    ['an empty Period', at(7, 1), at(7, 1),
      'reversed-period'],
    ['over 24 hours', at(6, 1), at(7, 1, 5),
      'period-too-long'],
    ['exactly 24 hours', at(6, 1), at(7, 1), null],
    ['ending in the future', at(9, 14), at(9, 15, 35),
      'future-date'],
    ['ending now', at(9, 14), now, null],
    ['overlapping a Period', at(7, 23), at(8, 2),
      'overlapping-period'],
    ['inside a Period', at(8, 2), at(8, 3),
      'overlapping-period'],
    ['touching a Period', at(8, 9), at(8, 10), null]
  ])('checks %s', (_, start, end, rule) => {
    expect(breaks({ start, end }, periods, now))
      .toBe(rule)
  })

  it('says why in a few words', () => {
    expect(reason('overlapping-period'))
      .toBe('It overlaps another period')
    expect(reason('internal'))
      .toBe('Something went wrong')
  })
})
