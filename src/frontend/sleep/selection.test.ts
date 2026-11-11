import { describe, expect, it } from 'vitest'
import type { SleepPeriod } from '@shared/sleep'
import {
  breaks,
  drag,
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

  describe('dragging', () => {
    // Between the Period on the 8th and one at noon.
    const own = { id: 2, start: at(8, 10), end: at(8, 11) }
    const all = [
      ...periods,
      own,
      { id: 3, start: at(8, 12), end: at(8, 13) }
    ]
    const moved = (
      end: 'start' | 'end',
      time: number
    ): SleepPeriod => drag(own, end, time, all, now)

    it('snaps the moved end', () => {
      expect(moved('start', at(8, 9, 32)))
        .toEqual({ ...own, start: at(8, 9, 30) })
      expect(moved('end', at(8, 11, 58)))
        .toEqual({ ...own, end: at(8, 12) })
    })

    it('stops at the neighbours', () => {
      expect(moved('start', at(8, 3)).start)
        .toBe(at(8, 9))
      expect(moved('end', at(8, 14)).end)
        .toBe(at(8, 12))
    })

    it("doesn't cross the other end", () => {
      expect(moved('start', at(8, 12)).start)
        .toBe(at(8, 10, 55))
      expect(moved('end', at(8, 9)).end)
        .toBe(at(8, 10, 5))
    })

    it('stays within 24 hours and the past', () => {
      const alone = { id: 4, start: at(9, 10), end: at(9, 11) }

      expect(drag(alone, 'start', at(7, 1), [], now).start)
        .toBe(at(8, 11))
      expect(drag(alone, 'end', at(9, 20), [], now).end)
        .toBe(at(9, 15, 30))
    })
  })

  it('says why in a few words', () => {
    expect(reason('overlapping-period'))
      .toBe('It overlaps another period')
    expect(reason('internal'))
      .toBe('Something went wrong')
  })
})
