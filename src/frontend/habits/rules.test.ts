import { describe, expect, it } from 'vitest'
import type {
  ArchivePeriod,
  Habit,
  HabitEntry
} from '@shared/habits'
import type { LocalDate } from '@shared/storage'
import {
  completion,
  countsOn,
  daySplit,
  eachDay,
  isPerfectDay,
  ratePercent,
  slip,
  streakRuns
} from './rules'

const habit = (
  id: number,
  created: LocalDate,
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
  to: LocalDate = from
): HabitEntry[] =>
  eachDay({ from, to }).map(date => ({ habitId, date }))

describe('countsOn', () => {
  const h = habit(1, '2026-03-05', [
    { start: '2026-03-10', end: '2026-03-12' },
    { start: '2026-03-20', end: null }
  ])
  const at = (
    day: LocalDate,
    selected = '2026-03-31'
  ): boolean =>
    countsOn(h, day, selected)

  it('starts on the created day', () => {
    expect(at('2026-03-04')).toBe(false)
    expect(at('2026-03-05')).toBe(true)
  })

  it('ends on the Selected Date', () => {
    expect(at('2026-03-08', '2026-03-08')).toBe(true)
    expect(at('2026-03-09', '2026-03-08')).toBe(false)
  })

  it('skips both ends of a closed Archive Period', () => {
    expect(at('2026-03-09')).toBe(true)
    expect(at('2026-03-10')).toBe(false)
    expect(at('2026-03-12')).toBe(false)
    expect(at('2026-03-13')).toBe(true)
  })

  it('skips every day of an open Archive Period', () => {
    expect(at('2026-03-19')).toBe(true)
    expect(at('2026-03-20')).toBe(false)
    expect(at('2026-03-31')).toBe(false)
  })
})

describe('completion', () => {
  it('pools done and counted days across Habits', () => {
    const habits = [
      habit(1, '2026-03-01'),
      habit(2, '2026-03-03')
    ]
    const entries = [
      ...done(1, '2026-03-01', '2026-03-04'),
      ...done(2, '2026-03-03')
    ]

    expect(completion(habits, entries, {
      from: '2026-03-01', to: '2026-03-04'
    }, '2026-03-04')).toEqual({ done: 5, counted: 6, rate: 5 / 6 })
  })

  it('ignores Entries on days a Habit does not count', () => {
    const h = habit(1, '2026-03-03', [
      { start: '2026-03-05', end: '2026-03-05' }
    ])
    const entries = done(1, '2026-03-01', '2026-03-07')

    expect(completion([h], entries, {
      from: '2026-03-01', to: '2026-03-07'
    }, '2026-03-06')).toEqual({ done: 3, counted: 3, rate: 1 })
  })

  it('has no Rate with nothing counted', () => {
    expect(completion([habit(1, '2026-04-01')], [], {
      from: '2026-03-01', to: '2026-03-31'
    }, '2026-04-10')).toEqual({ done: 0, counted: 0, rate: null })
  })
})

describe('slip', () => {
  // Earlier span: Mar 1-14. Recent span: Mar 15-28.
  const date = '2026-03-28'
  const earlier = done(1, '2026-03-01', '2026-03-14')

  it('is Slipping at exactly 20 points', () => {
    const h = habit(1, '2026-01-01', [
      { start: '2026-03-15', end: '2026-03-18' }
    ])
    const entries = [
      ...earlier, ...done(1, '2026-03-19', '2026-03-26')
    ]

    const found = slip(h, entries, date)
    expect(found).toMatchObject({ recent: 0.8, earlier: 1 })
    expect(ratePercent(found?.drop ?? 0)).toBe(20)
  })

  it('is not Slipping under 20 points', () => {
    const h = habit(1, '2026-01-01', [
      { start: '2026-03-15', end: '2026-03-17' }
    ])
    // 9 of 11 recent days: a drop of 18.2 points.
    const entries = [
      ...earlier, ...done(1, '2026-03-18', '2026-03-26')
    ]

    expect(slip(h, entries, date)).toBeNull()
  })

  it('needs a Rate on both sides', () => {
    expect(slip(habit(1, '2026-03-15'), [], date)).toBeNull()
  })
})

describe('isPerfectDay', () => {
  const habits = [
    habit(1, '2026-03-01'),
    habit(2, '2026-03-01', [
      { start: '2026-03-03', end: null }
    ])
  ]

  it('ignores Habits inside an Archive Period', () => {
    expect(isPerfectDay(habits, done(1, '2026-03-04'), '2026-03-04'))
      .toBe(true)
  })

  it('needs every counted Habit done', () => {
    expect(isPerfectDay(habits, done(1, '2026-03-02'), '2026-03-02'))
      .toBe(false)
  })

  it('needs at least one Habit counted', () => {
    expect(isPerfectDay(habits, [], '2026-02-28')).toBe(false)
  })
})

describe('ratePercent', () => {
  it('rounds to a whole percentage, halves away from zero', () => {
    expect(ratePercent(0)).toBe(0)
    expect(ratePercent(1)).toBe(100)
    expect(ratePercent(2 / 3)).toBe(67)
    expect(ratePercent(0.285)).toBe(29)
    expect(ratePercent(0.284)).toBe(28)
    expect(ratePercent(-0.285)).toBe(-29)
    expect(ratePercent(1 - 0.8)).toBe(20)
    expect(Object.is(ratePercent(-0.004), 0)).toBe(true)
  })
})

/** A day of November 2026. */
const nov = (day: number): LocalDate =>
  `2026-11-${String(day).padStart(2, '0')}`

const novHabit = (
  overrides: Partial<Habit> = {}
): Habit => ({
  id: 1,
  name: 'Reading',
  icon: 'reading',
  created: nov(1),
  archived: false,
  archivePeriods: [],
  ...overrides
})

const novPeriod = (
  start: number,
  end: number | null
): ArchivePeriod => ({
  start: nov(start),
  end: end === null ? null : nov(end)
})

const novDone = (
  days: readonly number[],
  habitId = 1
): HabitEntry[] =>
  days.map(day => ({ habitId, date: nov(day) }))

describe('daySplit', () => {
  it('splits counted days by whether it was done', () => {
    const split = daySplit(
      novHabit(),
      novDone([2, 4]),
      { from: nov(1), to: nov(5) },
      nov(30)
    )

    expect(split).toEqual({
      done: [nov(2), nov(4)],
      notDone: [nov(1), nov(3), nov(5)]
    })
  })

  it('leaves days it didn\'t count in neither', () => {
    const split = daySplit(
      novHabit({
        created: nov(3),
        archivePeriods: [novPeriod(5, 6)]
      }),
      // Entries on uncounted days are ignored.
      novDone([1, 3, 5, 8]),
      { from: nov(1), to: nov(8) },
      nov(30)
    )

    expect(split).toEqual({
      done: [nov(3), nov(8)],
      notDone: [nov(4), nov(7)]
    })
  })

  it('stops at the Selected Date', () => {
    const split = daySplit(
      novHabit(),
      novDone([3, 5]),
      { from: nov(1), to: nov(10) },
      nov(4)
    )

    expect(split).toEqual({
      done: [nov(3)],
      notDone: [nov(1), nov(2), nov(4)]
    })
  })

  it('reads only its own Entries', () => {
    const split = daySplit(
      novHabit(),
      novDone([1, 2], 2),
      { from: nov(1), to: nov(2) },
      nov(30)
    )

    expect(split.done).toEqual([])
  })
})

describe('streakRuns', () => {
  it('lists every run, oldest first', () => {
    expect(
      streakRuns(novHabit(), novDone([2, 3, 4, 6, 7]), nov(9))
    ).toEqual([
      { from: nov(2), to: nov(4), days: 3, ended: true },
      { from: nov(6), to: nov(7), days: 2, ended: true }
    ])
  })

  it('skips Archive Period days, not breaking', () => {
    const runs = streakRuns(
      novHabit({ archivePeriods: [novPeriod(5, 7)] }),
      novDone([3, 4, 8, 9]),
      nov(11)
    )

    expect(runs).toEqual([
      { from: nov(3), to: nov(9), days: 4, ended: true }
    ])
  })

  it('starts no earlier than created', () => {
    const runs = streakRuns(
      novHabit({ created: nov(4) }),
      novDone([2, 3, 4, 5]),
      nov(7)
    )

    expect(runs).toEqual([
      { from: nov(4), to: nov(5), days: 2, ended: true }
    ])
  })

  it('keeps a run open through an undone Selected Date', () => {
    expect(
      streakRuns(novHabit(), novDone([7, 8, 9]), nov(10))
    ).toEqual([
      { from: nov(7), to: nov(9), days: 3, ended: false }
    ])
  })

  it('keeps a run open through the Selected Date', () => {
    expect(
      streakRuns(novHabit(), novDone([9, 10]), nov(10))
    ).toEqual([
      { from: nov(9), to: nov(10), days: 2, ended: false }
    ])
  })

  it('ends a run on a miss before the Selected Date', () => {
    expect(
      streakRuns(novHabit(), novDone([7, 8]), nov(10))
    ).toEqual([
      { from: nov(7), to: nov(8), days: 2, ended: true }
    ])
  })

  it('keeps a run open into an open Archive Period', () => {
    const runs = streakRuns(
      novHabit({ archivePeriods: [novPeriod(6, null)] }),
      novDone([4, 5]),
      nov(20)
    )

    expect(runs).toEqual([
      { from: nov(4), to: nov(5), days: 2, ended: false }
    ])
  })

  it('ignores Entries after the Selected Date', () => {
    expect(streakRuns(novHabit(), novDone([5, 6]), nov(4)))
      .toEqual([])
  })

  it('crosses month and year ends', () => {
    const runs = streakRuns(
      novHabit({ created: '2026-12-30' }),
      [
        { habitId: 1, date: '2026-12-31' },
        { habitId: 1, date: '2027-01-01' }
      ],
      '2027-01-03'
    )

    expect(runs).toEqual([{
      from: '2026-12-31',
      to: '2027-01-01',
      days: 2,
      ended: true
    }])
  })
})
