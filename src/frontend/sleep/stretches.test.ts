import { describe, expect, it } from 'vitest'
import { localDate } from '@shared/dates'
import type { DateRange } from '@shared/storage'
import type { SleepPeriod } from '@shared/sleep'
import {
  sleepDays,
  sleepFetchRange,
  stretches,
  type SleepDay
} from './stretches'

/**
 * November 2026: the 9th is a Monday, so the weekday
 * names below match the calendar.
 */
const at = (
  day: number,
  hour: number,
  minute = 0
): number =>
  new Date(2026, 10, day, hour, minute).getTime()

const asleep = (hours: number, minutes = 0): number =>
  (hours * 60 + minutes) * 60_000

const period = (start: number, end: number): SleepPeriod =>
  ({ id: start, start, end })

const iso = (day: number): string =>
  `2026-11-${String(day).padStart(2, '0')}`

const range = (from: number, to = from): DateRange => ({
  from: iso(from),
  to: iso(to)
})

const only = (
  periods: readonly SleepPeriod[],
  day: number
): SleepDay => sleepDays(periods, range(day))[0]

describe('stretches', () => {
  it('joins a 45-minute gap and leaves the gap out', () => {
    const first = period(at(10, 1), at(10, 3))
    const second = period(at(10, 3, 45), at(10, 8))
    const { night, naps } = only([second, first], 10)

    expect(naps).toEqual([])
    expect(night).toMatchObject({
      start: first.start,
      end: second.end,
      asleepMs: asleep(6, 15),
      wakeUps: 1,
      periods: [first, second]
    })
  })

  it('joins Periods exactly 60 minutes apart', () => {
    const first = period(at(10, 1), at(10, 2))
    const second = period(at(10, 3), at(10, 4))

    expect(stretches([second, first])).toMatchObject([{
      wakeUps: 1,
      asleepMs: asleep(2),
      periods: [first, second]
    }])
  })

  it('splits Periods 61 minutes apart', () => {
    const first = period(at(10, 1), at(10, 2))
    const second = period(at(10, 3, 1), at(10, 4, 1))

    expect(stretches([first, second])).toMatchObject([
      { wakeUps: 0, periods: [first] },
      { wakeUps: 0, periods: [second] }
    ])
  })

  it('joins Periods that touch and counts the Wake-up', () => {
    const first = period(at(10, 1), at(10, 3))
    const second = period(at(10, 3), at(10, 5))

    expect(stretches([first, second])).toMatchObject([{
      start: first.start,
      end: second.end,
      asleepMs: asleep(4),
      wakeUps: 1
    }])
  })

  it('counts every Wake-up in the Stretch', () => {
    const periods = [
      period(at(10, 1), at(10, 2)),
      period(at(10, 2, 30), at(10, 3, 30)),
      period(at(10, 4, 30), at(10, 5, 30))
    ]

    expect(stretches(periods)).toMatchObject([{
      wakeUps: 2,
      asleepMs: asleep(3)
    }])
  })
})

describe('sleepDays', () => {
  it('keeps a 7h Night and one 40-minute Nap', () => {
    const nap = period(at(10, 15), at(10, 15, 40))
    const night = period(at(10, 0), at(10, 7))
    const day = only([nap, night], 10)

    expect(day.night).toMatchObject({
      start: night.start,
      asleepMs: asleep(7),
      wakeUps: 0
    })
    expect(day.naps).toMatchObject([{
      start: nap.start,
      asleepMs: asleep(0, 40)
    }])
  })

  it('lists Naps earliest first', () => {
    const periods = [
      period(at(10, 18), at(10, 18, 30)),
      period(at(10, 0), at(10, 7)),
      period(at(10, 13), at(10, 13, 20))
    ]

    expect(only(periods, 10).naps.map(nap => nap.start))
      .toEqual([at(10, 13), at(10, 18)])
  })

  it('picks the earlier Stretch when two tie', () => {
    const earlier = period(at(10, 1), at(10, 4))
    const later = period(at(10, 15), at(10, 18))
    const { night, naps } = only([later, earlier], 10)

    expect(night?.start).toBe(earlier.start)
    expect(night?.asleepMs).toBe(asleep(3))
    expect(naps.map(nap => nap.start)).toEqual([later.start])
  })

  it('gives a day with no Periods no Night and no Naps', () => {
    expect(sleepDays([], range(10, 12))).toEqual([
      { day: iso(10), night: null, naps: [] },
      { day: iso(11), night: null, naps: [] },
      { day: iso(12), night: null, naps: [] }
    ])
  })

  it('files Mon 23:30 to Tue 07:00 as Tuesday\'s Night', () => {
    const night = period(at(9, 23, 30), at(10, 7))
    const days = sleepDays([night], range(9, 10))

    expect(days[0]).toEqual({
      day: iso(9),
      night: null,
      naps: []
    })
    expect(days[1].night).toMatchObject({
      day: iso(10),
      start: at(9, 23, 30),
      end: at(10, 7),
      asleepMs: asleep(7, 30),
      wakeUps: 0
    })
  })

  it('keeps one Night per day when bedtimes alternate', () => {
    const periods = [
      period(at(8, 23, 30), at(9, 7)),
      period(at(10, 0, 30), at(10, 7, 30)),
      period(at(10, 23, 30), at(11, 7)),
      period(at(12, 0, 30), at(12, 7, 30)),
      period(at(12, 23, 30), at(13, 7)),
      period(at(14, 0, 30), at(14, 7, 30)),
      period(at(14, 23, 30), at(15, 7))
    ]
    const days = sleepDays([...periods].reverse(), range(9, 15))

    expect(days.map(sleepDay => sleepDay.day)).toEqual([
      iso(9), iso(10), iso(11), iso(12),
      iso(13), iso(14), iso(15)
    ])
    expect(days.map(sleepDay => sleepDay.night?.end)).toEqual([
      at(9, 7),
      at(10, 7, 30),
      at(11, 7),
      at(12, 7, 30),
      at(13, 7),
      at(14, 7, 30),
      at(15, 7)
    ])
    expect(days.map(sleepDay => sleepDay.naps)).toEqual(
      periods.map(() => [])
    )
  })

  it('keeps a Tuesday afternoon sleep as a Nap', () => {
    const night = period(at(9, 23, 30), at(10, 7))
    const nap = period(at(10, 15), at(10, 15, 40))
    const day = only([nap, night], 10)

    expect(day.night?.start).toBe(night.start)
    expect(day.naps).toMatchObject([{
      start: nap.start,
      end: nap.end,
      asleepMs: asleep(0, 40)
    }])
  })

  it('joins a 30-minute gap into a 7h30m Tuesday Night', () => {
    const first = period(at(9, 23), at(10, 1))
    const second = period(at(10, 1, 30), at(10, 7))
    const days = sleepDays([second, first], range(9, 10))

    expect(days[0].night).toBeNull()
    expect(days[0].naps).toEqual([])
    expect(days[1].night).toMatchObject({
      day: iso(10),
      start: first.start,
      end: second.end,
      asleepMs: asleep(7, 30),
      wakeUps: 1
    })
    expect(days[1].naps).toEqual([])
  })

  it('makes a late nap the Night when nothing is longer', () => {
    const late = period(at(9, 22), at(10, 0, 20))
    const { night, naps } = only([late], 10)

    expect(naps).toEqual([])
    expect(night).toMatchObject({
      day: iso(10),
      start: late.start,
      end: late.end,
      asleepMs: asleep(2, 20),
      wakeUps: 0
    })
  })

  it('keeps a late nap a Nap beside a longer Stretch', () => {
    const late = period(at(9, 22), at(10, 0, 20))
    const longer = period(at(10, 2), at(10, 9))
    const { night, naps } = only([late, longer], 10)

    expect(night).toMatchObject({
      start: longer.start,
      asleepMs: asleep(7)
    })
    expect(naps).toMatchObject([{
      start: late.start,
      asleepMs: asleep(2, 20)
    }])
  })

  it('gives a day no Night when no Stretch ends on it', () => {
    const crossing = period(at(10, 23, 30), at(11, 7))
    const days = sleepDays([crossing], range(10, 11))

    expect(days[0]).toEqual({
      day: iso(10),
      night: null,
      naps: []
    })
    expect(days[1].night?.day).toBe(iso(11))
  })

  it('files a Tail at exactly 00:00 on the new day', () => {
    const days = sleepDays(
      [period(at(10, 22), at(11, 0))],
      range(10, 11)
    )

    expect(days[0].night).toBeNull()
    expect(days[1].night).toMatchObject({
      day: iso(11),
      end: at(11, 0),
      asleepMs: asleep(2)
    })
  })

  it('classifies both edges from the extra day either side',
    () => {
      const asked = range(10, 12)
      const before = period(at(9, 23), at(10, 7))
      const monday = period(at(9, 15), at(9, 15, 20))
      const nap = period(at(10, 14), at(10, 14, 30))
      const wednesday = period(at(10, 23, 30), at(11, 6, 30))
      const thursday = period(at(11, 23), at(12, 6))
      const evening = period(at(12, 22, 30), at(12, 23, 40))
      const after = period(at(13, 0, 10), at(13, 7))
      const tooEarly = period(at(8, 1), at(8, 8))
      const fetched = sleepFetchRange(asked)
      const periods = [
        tooEarly,
        monday,
        before,
        nap,
        wednesday,
        thursday,
        evening,
        after
      ].filter(item => {
        const head = localDate(new Date(item.start))
        return head >= fetched.from && head <= fetched.to
      })
      const days = sleepDays(periods, asked)

      expect(periods).not.toContain(tooEarly)
      expect(periods).toContain(before)
      expect(periods).toContain(after)
      expect(days.map(sleepDay => sleepDay.day)).toEqual([
        iso(10), iso(11), iso(12)
      ])
      expect(days[0].night).toMatchObject({
        start: before.start,
        end: before.end,
        asleepMs: asleep(8),
        wakeUps: 0
      })
      expect(days[0].naps).toMatchObject([{
        start: nap.start,
        asleepMs: asleep(0, 30)
      }])
      expect(days[1].night).toMatchObject({
        start: wednesday.start,
        asleepMs: asleep(7)
      })
      expect(days[1].naps).toEqual([])
      expect(days[2].night).toMatchObject({
        start: thursday.start,
        end: thursday.end,
        asleepMs: asleep(7)
      })
      expect(days[2].naps).toEqual([])
    })
})

describe('sleepFetchRange', () => {
  it('widens by one day across a month and a year', () => {
    expect(sleepFetchRange({
      from: '2026-11-01',
      to: '2026-11-01'
    })).toEqual({
      from: '2026-10-31',
      to: '2026-11-02'
    })
    expect(sleepFetchRange({
      from: '2026-01-01',
      to: '2026-12-31'
    })).toEqual({
      from: '2025-12-31',
      to: '2027-01-01'
    })
  })
})
