import { describe, expect, it } from 'vitest'
import type {
  ArchivePeriod,
  Habit,
  HabitEntry
} from '@shared/habits'
import type { LocalDate } from '@shared/storage'
import {
  bestDay,
  mostSkippedDay,
  perfectDays,
  slipping,
  strongest,
  thisMonth,
  today,
  trend,
  weeklyCompletion
} from './overview'
import { completion, eachDay, ratePercent } from './rules'

const habit = (
  id: number,
  created: LocalDate = '2025-01-01',
  archivePeriods: ArchivePeriod[] = []
): Habit => ({
  id,
  name: `Habit ${id}`,
  icon: 'reading',
  created,
  archived: archivePeriods.some(p => p.end === null),
  archivePeriods
})

const done = (
  habitId: number,
  from: LocalDate,
  to: LocalDate = from,
  keep: (day: LocalDate) => boolean = () => true
): HabitEntry[] => eachDay({ from, to })
  .filter(keep)
  .map(date => ({ habitId, date }))

const weekday = (day: LocalDate): number =>
  new Date(`${day}T00:00`).getDay()

const US = { weekStartsOn: 0, firstWeekContainsDate: 1 }
const ISO = { weekStartsOn: 1, firstWeekContainsDate: 4 }

describe('today', () => {
  it('shows done out of counted Habits on the date', () => {
    const habits = [1, 2, 3, 4, 5, 6].map(id => habit(id))
    const entries = [1, 2, 3].flatMap(id => done(id, '2026-03-10'))

    expect(today(habits, entries, '2026-03-10'))
      .toEqual({ done: 3, counted: 6 })
  })

  it('leaves out archived Habits', () => {
    const habits = [
      habit(1),
      habit(2, '2025-01-01', [{ start: '2026-03-01', end: null }])
    ]

    expect(today(habits, [], '2026-03-10'))
      .toEqual({ done: 0, counted: 1 })
  })

  it('is null when no Habit counts', () => {
    expect(today([habit(1, '2026-03-11')], [], '2026-03-10'))
      .toBeNull()
  })
})

describe('perfectDays', () => {
  it('counts month to date, skipping Archive Periods', () => {
    const habits = [
      habit(1),
      habit(2, '2025-01-01', [
        { start: '2026-03-03', end: '2026-03-03' }
      ])
    ]
    const entries = [
      ...done(1, '2026-02-28', '2026-03-06'),
      ...done(2, '2026-02-28'),
      ...done(2, '2026-03-01', '2026-03-02'),
      ...done(2, '2026-03-04'),
      ...done(2, '2026-03-06')
    ]

    // Mar 1-4 are perfect (3 despite Habit 2 not done),
    // Mar 5 is not, Mar 6 is after the date.
    expect(perfectDays(habits, entries, '2026-03-05')).toBe(4)
  })
})

describe('thisMonth', () => {
  it('is the Rate of all Habits month to date', () => {
    const habits = [habit(1), habit(2)]
    const entries = [
      ...done(1, '2026-02-01', '2026-02-28'),
      ...done(1, '2026-03-01', '2026-03-05'),
      ...done(2, '2026-03-01', '2026-03-02')
    ]

    expect(thisMonth(habits, entries, '2026-03-05')).toBe(7 / 10)
    expect(thisMonth([], entries, '2026-03-05')).toBeNull()
  })
})

describe('weeklyCompletion', () => {
  it('returns 12 Locale weeks ending with the date', () => {
    const weeks = weeklyCompletion([], [], '2026-03-04', US)

    expect(weeks).toHaveLength(12)
    expect(weeks[0]).toMatchObject({
      from: '2025-12-14', to: '2025-12-20', week: 51
    })
    expect(weeks[11]).toMatchObject({
      from: '2026-03-01', to: '2026-03-04', week: 10, rate: null
    })
  })

  it('follows the Locale week start and numbering', () => {
    const weeks = weeklyCompletion([], [], '2026-03-04', ISO)

    expect(weeks[11]).toMatchObject({
      from: '2026-03-02', to: '2026-03-04', week: 10
    })
  })

  it('numbers weeks across the new year', () => {
    const weeks = weeklyCompletion([], [], '2026-01-01', ISO)

    expect(weeks.slice(-2)).toMatchObject([
      { from: '2025-12-22', to: '2025-12-28', week: 52 },
      { from: '2025-12-29', to: '2026-01-01', week: 1 }
    ])
  })

  it('uses only counted days, up to the date', () => {
    // Created on Thursday of the week before last.
    const h = habit(1, '2026-02-19')
    const entries = [
      ...done(1, '2026-02-19'),
      ...done(1, '2026-02-23', '2026-02-26'),
      ...done(1, '2026-03-01', '2026-03-07')
    ]

    const weeks = weeklyCompletion([h], entries, '2026-03-04', ISO)

    expect(weeks[8].rate).toBeNull()
    // Feb 19-22: 1 of 4. Feb 23-Mar 1: 5 of 7.
    expect(weeks[9].rate).toBe(1 / 4)
    expect(weeks[10].rate).toBe(5 / 7)
    // Mar 2-4 only: Mar 5-7 are after the date.
    expect(weeks[11].rate).toBe(1)
  })
})

describe('strongest', () => {
  it('picks the highest Rate month to date', () => {
    const habits = [habit(1), habit(2), habit(3)]
    const entries = [
      ...done(1, '2026-03-01', '2026-03-05'),
      ...done(2, '2026-03-01', '2026-03-09'),
      ...done(3, '2026-03-01', '2026-03-09')
    ]

    const found = strongest(habits, entries, '2026-03-10')

    // Ties go to the earlier Habit.
    expect(found?.habit.id).toBe(2)
    expect(found?.rate).toBe(0.9)
  })

  it('agrees with the Board Rate for the same Habit', () => {
    const h = habit(1, '2026-03-04', [
      { start: '2026-03-07', end: '2026-03-08' }
    ])
    const entries = done(1, '2026-03-04', '2026-03-10',
      day => day !== '2026-03-09')
    const board = completion([h], entries, {
      from: '2026-03-01', to: '2026-03-10'
    }, '2026-03-10')

    const found = strongest([h], entries, '2026-03-10')

    expect(ratePercent(found?.rate ?? -1))
      .toBe(ratePercent(board.rate ?? -2))
  })

  it('includes archived Habits for the days they counted', () => {
    const habits = [
      habit(1),
      habit(2, '2025-01-01', [{ start: '2026-03-06', end: null }])
    ]
    const entries = [
      ...done(1, '2026-03-01', '2026-03-05'),
      ...done(2, '2026-03-01', '2026-03-05')
    ]

    expect(strongest(habits, entries, '2026-03-10'))
      .toMatchObject({ habit: { id: 2 }, rate: 1 })
  })

  it('is null with nothing counted', () => {
    expect(strongest([habit(1, '2026-04-01')], [], '2026-03-10'))
      .toBeNull()
  })
})

describe('slipping', () => {
  const date = '2026-03-28'

  it('picks the Slipping Habit with the biggest drop', () => {
    const habits = [habit(1), habit(2), habit(3)]
    const entries = [
      // 14/14 then 10/14: 28.6 points.
      ...done(1, '2026-03-01', '2026-03-24'),
      // 14/14 then 7/14: 50 points.
      ...done(2, '2026-03-01', '2026-03-21'),
      // Steady: not Slipping.
      ...done(3, '2026-03-01', '2026-03-28')
    ]

    expect(slipping(habits, entries, date)).toMatchObject({
      habit: { id: 2 }, earlier: 1, recent: 0.5, points: 50
    })
  })

  it('is null when no Habit is Slipping', () => {
    const entries = done(1, '2026-03-01', '2026-03-28')

    expect(slipping([habit(1)], entries, date)).toBeNull()
  })
})

describe('bestDay and mostSkippedDay', () => {
  const date = '2026-03-28'
  // Fridays always, Mondays never, other days half.
  const entries = done(1, '2025-12-01', date, day => {
    const d = weekday(day)
    if (d === 5) return true
    if (d === 1) return false
    return Number(day.slice(8)) % 2 === 0
  })

  it('find the highest and lowest weekday Rates', () => {
    expect(bestDay([habit(1)], entries, date, 1))
      .toMatchObject({ weekday: 5, rate: 1 })
    expect(mostSkippedDay([habit(1)], entries, date, 1))
      .toMatchObject({ weekday: 1, rate: 0 })
  })

  it('look back over only the last 84 days', () => {
    // Done every day before the window, never in it.
    const old = done(1, '2025-01-01', '2026-01-03')

    expect(bestDay([habit(1)], old, date, 1))
      .toMatchObject({ rate: 0 })
  })

  it('break ties by the Locale week order', () => {
    const all = done(1, '2025-12-01', date)

    expect(bestDay([habit(1)], all, date, 1)?.weekday).toBe(1)
    expect(bestDay([habit(1)], all, date, 0)?.weekday).toBe(0)
    expect(mostSkippedDay([habit(1)], [], date, 6)?.weekday)
      .toBe(6)
  })

  it('are null with nothing counted', () => {
    expect(bestDay([], entries, date, 1)).toBeNull()
    expect(mostSkippedDay([], entries, date, 1)).toBeNull()
  })
})

describe('trend', () => {
  it('compares Mar 31 against Feb 1-28', () => {
    const entries = [
      ...done(1, '2026-02-01', '2026-02-14'),
      ...done(1, '2026-03-01', '2026-03-31',
        day => Number(day.slice(8)) <= 25)
    ]

    expect(trend([habit(1)], entries, '2026-03-31')).toEqual({
      current: 25 / 31,
      previous: 0.5,
      points: 31,
      comparedTo: { from: '2026-02-01', to: '2026-02-28' }
    })
  })

  it('has a sign when the Rate fell', () => {
    const entries = [
      ...done(1, '2026-02-01', '2026-02-10'),
      ...done(1, '2026-03-01', '2026-03-05')
    ]

    expect(trend([habit(1)], entries, '2026-03-10')?.points)
      .toBe(-50)
  })

  it('is null when last month has no Rate', () => {
    expect(trend([habit(1, '2026-03-01')], [], '2026-03-10'))
      .toBeNull()
  })
})
