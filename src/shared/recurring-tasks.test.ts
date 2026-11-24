import { describe, expect, it } from 'vitest'
import {
  compareForDay,
  type DayItem,
  occursOn,
  type Recurrence,
  scheduledDays,
  type TaskSchedule
} from './recurring-tasks'

const rule = (
  schedule: TaskSchedule,
  firstDay = '2020-01-01',
  lastDay: string | null = null
): Recurrence => ({ schedule, firstDay, lastDay })

const monThu = rule({ kind: 'weekly', weekdays: [1, 4] })

describe('scheduledDays', () => {
  it('lists every Monday and Thursday of a span', () => {
    expect(scheduledDays(monThu, {
      from: '2026-11-23',
      to: '2026-12-06'
    })).toEqual([
      '2026-11-23',
      '2026-11-26',
      '2026-11-30',
      '2026-12-03'
    ])
  })

  it('names Sunday as weekday 0', () => {
    const sundays = rule({ kind: 'weekly', weekdays: [0] })
    expect(scheduledDays(sundays, {
      from: '2026-11-23',
      to: '2026-12-06'
    })).toEqual(['2026-11-29', '2026-12-06'])
  })

  it('falls on a month\'s last day when it lacks D', () => {
    const the31st = rule({ kind: 'monthly', day: 31 })
    expect(scheduledDays(the31st, {
      from: '2026-01-01',
      to: '2026-04-30'
    })).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30'
    ])
    expect(scheduledDays(the31st, {
      from: '2024-02-01',
      to: '2024-02-29'
    })).toEqual(['2024-02-29'])
  })

  it('keeps a monthly day that every month has', () => {
    const the15th = rule({ kind: 'monthly', day: 15 })
    expect(scheduledDays(the15th, {
      from: '2026-11-01',
      to: '2027-01-31'
    })).toEqual(['2026-11-15', '2026-12-15', '2027-01-15'])
  })

  it('falls on Feb 28 for Feb 29 outside leap years', () => {
    const leapDay = rule({
      kind: 'yearly', month: 2, day: 29
    })
    expect(scheduledDays(leapDay, {
      from: '2024-01-01',
      to: '2028-12-31'
    })).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29'
    ])
  })

  it('lists a yearly day once a year', () => {
    const ides = rule({ kind: 'yearly', month: 3, day: 15 })
    expect(scheduledDays(ides, {
      from: '2026-01-01',
      to: '2027-12-31'
    })).toEqual(['2026-03-15', '2027-03-15'])
  })

  it('counts every N days from the first day', () => {
    const everyThird = rule(
      { kind: 'days', every: 3 },
      '2026-11-02'
    )
    expect(scheduledDays(everyThird, {
      from: '2026-11-06',
      to: '2026-11-14'
    })).toEqual(['2026-11-08', '2026-11-11', '2026-11-14'])
  })

  it('counts across a year boundary and DST', () => {
    const everyOther = rule(
      { kind: 'days', every: 2 },
      '2025-12-30'
    )
    expect(scheduledDays(everyOther, {
      from: '2025-12-29',
      to: '2026-01-04'
    })).toEqual(['2025-12-30', '2026-01-01', '2026-01-03'])

    const weekly = rule({ kind: 'days', every: 7 }, '2026-03-01')
    expect(scheduledDays(weekly, {
      from: '2026-03-01',
      to: '2026-04-05'
    })).toEqual([
      '2026-03-01',
      '2026-03-08',
      '2026-03-15',
      '2026-03-22',
      '2026-03-29',
      '2026-04-05'
    ])
  })

  it('lists every day for every 1 day', () => {
    const daily = rule({ kind: 'days', every: 1 })
    expect(scheduledDays(daily, {
      from: '2026-02-27',
      to: '2026-03-02'
    })).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02'
    ])
  })

  it('starts on the first scheduled day on or after the first day', () => {
    const thursdays = rule(
      { kind: 'weekly', weekdays: [4] },
      '2026-11-25'
    )
    expect(scheduledDays(thursdays, {
      from: '2026-11-23',
      to: '2026-11-29'
    })).toEqual(['2026-11-26'])
    expect(scheduledDays(thursdays, {
      from: '2026-11-16',
      to: '2026-11-22'
    })).toEqual([])
  })

  it('stops after the last day', () => {
    const stopped = rule(
      { kind: 'weekly', weekdays: [4] },
      '2026-11-01',
      '2026-11-26'
    )
    expect(scheduledDays(stopped, {
      from: '2026-11-23',
      to: '2026-12-10'
    })).toEqual(['2026-11-26'])
  })
})

describe('occursOn', () => {
  it('is true on a scheduled day only', () => {
    expect(occursOn(monThu, '2026-11-26')).toBe(true)
    expect(occursOn(monThu, '2026-11-27')).toBe(false)
  })

  it('is false before the first day', () => {
    const later = { ...monThu, firstDay: '2026-11-24' }
    expect(occursOn(later, '2026-11-23')).toBe(false)
    expect(occursOn(later, '2026-11-26')).toBe(true)
  })

  it('is false after the last day, true on it', () => {
    const stopped = { ...monThu, lastDay: '2026-11-26' }
    expect(occursOn(stopped, '2026-11-26')).toBe(true)
    expect(occursOn(stopped, '2026-11-30')).toBe(false)
  })

  it('follows the anchor for every N days', () => {
    const everyThird = rule(
      { kind: 'days', every: 3 },
      '2026-11-02'
    )
    expect(occursOn(everyThird, '2026-11-02')).toBe(true)
    expect(occursOn(everyThird, '2026-11-05')).toBe(true)
    expect(occursOn(everyThird, '2026-11-06')).toBe(false)
  })

  it('applies the month clamp', () => {
    const the31st = rule({ kind: 'monthly', day: 31 })
    expect(occursOn(the31st, '2026-02-28')).toBe(true)
    expect(occursOn(the31st, '2024-02-28')).toBe(false)
    expect(occursOn(the31st, '2024-02-29')).toBe(true)
  })
})

describe('compareForDay', () => {
  const item = (
    day: string | null,
    time: string | null,
    created: number
  ): DayItem => ({ day, time, created })

  it('orders by day, time, then when added', () => {
    const items = [
      item(null, null, 1),
      item('2026-11-25', null, 5),
      item('2026-11-24', null, 9),
      item('2026-11-24', '18:00', 3),
      item('2026-11-24', null, 2),
      item('2026-11-24', '07:30', 8)
    ]
    expect(items.toSorted(compareForDay)).toEqual([
      item('2026-11-24', '07:30', 8),
      item('2026-11-24', '18:00', 3),
      item('2026-11-24', null, 2),
      item('2026-11-24', null, 9),
      item('2026-11-25', null, 5),
      item(null, null, 1)
    ])
  })
})
