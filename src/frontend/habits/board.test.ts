import { afterEach, describe, expect, it } from 'vitest'
import type {
  ArchivePeriod,
  Habit,
  HabitEntry
} from '@shared/habits'
import type { LocalDate } from '@shared/storage'
import { setLocaleOverride } from '@/locale/format'
import {
  boardTicks,
  boardWindow,
  formatBoardRange,
  habitBoard,
  rateTone,
  type BoardTick
} from './board'
import { eachDay } from './rules'

const habit = (
  id: number,
  created: LocalDate = '2026-01-01',
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

afterEach(() => {
  setLocaleOverride(null)
})

describe('boardWindow', () => {
  it('spans from the 1st through Selected Date', () => {
    expect(boardWindow('2026-11-01')).toEqual({
      from: '2026-11-01', to: '2026-11-01'
    })
    expect(eachDay(boardWindow('2026-11-01'))).toHaveLength(1)
    expect(eachDay(boardWindow('2026-11-21'))).toHaveLength(21)
  })

  it('handles 28, 29 (leap), 30 and 31-day months', () => {
    expect(eachDay(boardWindow('2026-02-28'))).toHaveLength(28)
    expect(eachDay(boardWindow('2028-02-29'))).toHaveLength(29)
    expect(eachDay(boardWindow('2026-11-30'))).toHaveLength(30)
    expect(eachDay(boardWindow('2026-03-31'))).toHaveLength(31)
  })
})

describe('formatBoardRange', () => {
  it('shows a single short date on day 1 and a range after', () => {
    setLocaleOverride('en-US')

    expect(formatBoardRange(boardWindow('2026-11-01')))
      .toBe('Nov 1')
    expect(formatBoardRange(boardWindow('2026-11-19')))
      .toBe('Nov 1 – Nov 19')
  })

  it('follows the Locale', () => {
    setLocaleOverride('pt-BR')

    expect(formatBoardRange(boardWindow('2026-11-01')))
      .toBe('1 de nov.')
    expect(formatBoardRange(boardWindow('2026-11-19')))
      .toBe('1 de nov. – 19 de nov.')
  })
})

describe('boardTicks', () => {
  const ticksFor = (day: LocalDate, isToday = true): BoardTick[] =>
    boardTicks(eachDay(boardWindow(day)), isToday)

  it('returns nothing for an empty list', () => {
    expect(boardTicks([], true)).toEqual([])
  })

  it('shows only the final tick on day 1 through day 5', () => {
    setLocaleOverride('en-US')

    expect(ticksFor('2026-11-01', true)).toEqual([{
      index: 0, date: '2026-11-01', label: 'Today', isLast: true
    }])
    expect(ticksFor('2026-11-01', false)).toEqual([{
      index: 0, date: '2026-11-01', label: 'Nov 1', isLast: true
    }])
    expect(ticksFor('2026-11-05').map(t => t.index))
      .toEqual([4])
  })

  it('places day 1, 11th and 21st, skipping ticks near the end', () => {
    setLocaleOverride('en-US')

    expect(ticksFor('2026-11-06').map(t => t.index))
      .toEqual([0, 5])
    expect(ticksFor('2026-11-15').map(t => t.index))
      .toEqual([0, 14])
    expect(ticksFor('2026-11-16').map(t => t.index))
      .toEqual([0, 10, 15])
    expect(ticksFor('2026-11-21', true)).toEqual([
      { index: 0, date: '2026-11-01', label: 'Nov 1', isLast: false },
      { index: 10, date: '2026-11-11', label: 'Nov 11', isLast: false },
      { index: 20, date: '2026-11-21', label: 'Today', isLast: true }
    ])
    expect(ticksFor('2026-11-25').map(t => t.index))
      .toEqual([0, 10, 24])
    expect(ticksFor('2026-11-26').map(t => t.index))
      .toEqual([0, 10, 20, 25])
  })

  it('handles 28, 29, 30 and 31-day months without duplicates', () => {
    setLocaleOverride('en-US')

    expect(ticksFor('2026-02-28', false).map(t => t.label))
      .toEqual(['Feb 1', 'Feb 11', 'Feb 21', 'Feb 28'])
    expect(ticksFor('2028-02-29', false).map(t => t.label))
      .toEqual(['Feb 1', 'Feb 11', 'Feb 21', 'Feb 29'])
    expect(ticksFor('2026-11-30', false).map(t => t.label))
      .toEqual(['Nov 1', 'Nov 11', 'Nov 21', 'Nov 30'])
    expect(ticksFor('2026-03-31', false).map(t => t.index))
      .toEqual([0, 10, 20, 30])
  })
})

describe('rateTone', () => {
  it('classifies against the Habit Goal and 50%', () => {
    expect(rateTone(80, 80)).toBe('good')
    expect(rateTone(79, 80)).toBe('neutral')
    expect(rateTone(50, 80)).toBe('neutral')
    expect(rateTone(49, 80)).toBe('low')
    expect(rateTone(40, 40)).toBe('good')
    expect(rateTone(39, 40)).toBe('low')
    expect(rateTone(null, 75)).toBe('neutral')
  })
})

describe('habitBoard', () => {
  it('orders active Habits before archived, oldest first', () => {
    const habits = [
      habit(4, '2026-01-01', [{ start: '2026-11-15', end: null }]),
      habit(2, '2026-03-01'),
      habit(3, '2026-02-01', [{ start: '2026-11-10', end: null }]),
      habit(1, '2026-02-01'),
      habit(5, '2026-02-01')
    ]

    const board = habitBoard(habits, [], '2026-11-20')

    expect(board.rows.map(r => r.habit.id))
      .toEqual([1, 5, 2, 4, 3])
  })

  it('drops Habits with no counted days in the window', () => {
    const habits = [
      habit(1, '2026-11-25'),
      habit(2, '2026-01-01', [{ start: '2026-10-20', end: null }]),
      habit(3, '2026-01-01', [
        { start: '2026-11-01', end: '2026-11-20' }
      ]),
      habit(4, '2026-11-10')
    ]

    const board = habitBoard(habits, [], '2026-11-20')

    expect(board.rows.map(r => r.habit.id)).toEqual([4])
  })

  it('marks blank, dim, done, selected and interactive cells', () => {
    const active = habit(1, '2026-11-03')
    const archived = habit(2, '2026-11-01', [
      { start: '2026-11-04', end: null }
    ])
    // Entries on uncounted days (Nov 1, Nov 5, Nov 6) are ignored.
    const entries = [
      ...done(1, '2026-11-01'),
      ...done(1, '2026-11-04', '2026-11-06'),
      ...done(2, '2026-11-02', '2026-11-05')
    ]

    const board = habitBoard([active, archived], entries, '2026-11-05')
    const [activeRow, archivedRow] = board.rows

    expect(activeRow.cells.map(c => c.state))
      .toEqual(['blank', 'blank', 'dim', 'done', 'done'])
    expect(activeRow.cells.map(c => c.interactive))
      .toEqual([false, false, true, true, true])
    expect(activeRow.cells.map(c => c.isSelected))
      .toEqual([false, false, false, false, true])

    expect(archivedRow.cells.map(c => c.state))
      .toEqual(['dim', 'done', 'done', 'blank', 'blank'])
    expect(archivedRow.cells.every(c => !c.interactive)).toBe(true)
    expect(archivedRow.cells.every(c => !c.isSelected)).toBe(true)
  })

  it('outlines an undone counted Selected Date and keeps Streak', () => {
    const h = habit(1, '2026-11-01')
    const entries = done(1, '2026-11-02', '2026-11-04')

    const [row] = habitBoard([h], entries, '2026-11-05').rows

    expect(row.streak).toBe(3)
    expect(row.highlightStreak).toBe(false)
    expect(row.cells[4]).toMatchObject({
      date: '2026-11-05',
      state: 'dim',
      isSelected: true,
      inCurrentStreak: false,
      interactive: true
    })
    expect(row.cells.map(c => c.inCurrentStreak))
      .toEqual([false, true, true, true, false])
  })

  it('bridges Archive Periods and highlights Streaks >= 7', () => {
    const h = habit(1, '2026-10-25', [
      { start: '2026-11-05', end: '2026-11-12' }
    ])
    // Oct 30-31 (2) + Nov 1-4 (4) + Nov 13 (1) = 7-day Streak.
    const entries = [
      ...done(1, '2026-10-30', '2026-11-04'),
      ...done(1, '2026-11-13')
    ]

    const [row] = habitBoard([h], entries, '2026-11-13').rows

    expect(row.streak).toBe(7)
    expect(row.best).toBe(7)
    expect(row.highlightStreak).toBe(true)
    expect(row.rate).toBe(100)
    // Nov 5-12 are blank, non-interactive and not glowing.
    for (const cell of row.cells.slice(4, 12)) {
      expect(cell).toMatchObject({
        state: 'blank',
        interactive: false,
        inCurrentStreak: false
      })
    }
    expect(row.cells[0].inCurrentStreak).toBe(true)
    expect(row.cells[12].inCurrentStreak).toBe(true)
  })

  it('keeps all-time Best Streak when the current Streak breaks', () => {
    const h = habit(1, '2026-09-01')
    const entries = [
      ...done(1, '2026-09-01', '2026-09-12'),
      ...done(1, '2026-11-01', '2026-11-03')
    ]

    const [row] = habitBoard([h], entries, '2026-11-05').rows

    expect(row.streak).toBe(0)
    expect(row.best).toBe(12)
    expect(row.highlightStreak).toBe(false)
    expect(row.cells.every(c => !c.inCurrentStreak)).toBe(true)
  })

  it('computes window Rate with Habit Goal and Slipping flag', () => {
    const createdLate = habit(1, '2026-11-10')
    const sliding = habit(2, '2026-10-01')
    const entries = [
      // 8 of 10 counted days (Nov 10-19) -> 80%.
      ...done(1, '2026-11-10', '2026-11-17'),
      // Earlier 14d (Oct 23-Nov 5): 14/14; recent 14d (Nov 6-19): 4/14.
      ...done(2, '2026-10-23', '2026-11-09')
    ]

    const board = habitBoard(
      [createdLate, sliding],
      entries,
      '2026-11-19',
      { goal: 80, isToday: true }
    )
    const [slidingRow, lateRow] = board.rows

    expect(lateRow).toMatchObject({
      rate: 80, rateTone: 'good', slipping: false
    })
    expect(lateRow.cells.slice(0, 9).every(c => c.state === 'blank'))
      .toBe(true)
    expect(slidingRow).toMatchObject({
      rate: 47, rateTone: 'low', slipping: true
    })
  })

  it('handles day 1, default goal and 6-day highlight boundary', () => {
    setLocaleOverride('en-US')
    const h = habit(1, '2026-10-01')
    // Oct 26-31 (6 days) -> streak 6 (not highlighted).
    const sixDay = habitBoard(
      [h],
      done(1, '2026-10-26', '2026-10-31'),
      '2026-11-01',
      { isToday: true }
    )

    expect(sixDay.days).toEqual(['2026-11-01'])
    expect(sixDay.ticks).toEqual([{
      index: 0, date: '2026-11-01', label: 'Today', isLast: true
    }])
    expect(sixDay.rows[0]).toMatchObject({
      streak: 6,
      highlightStreak: false,
      best: 6,
      rate: 0,
      rateTone: 'low'
    })
    expect(sixDay.rows[0].cells).toEqual([{
      date: '2026-11-01',
      state: 'dim',
      inCurrentStreak: false,
      isSelected: true,
      interactive: true
    }])

    // Default goal is 75%: 3 of 4 days -> 75% is good.
    const defaultGoal = habitBoard(
      [h],
      done(1, '2026-11-01', '2026-11-03'),
      '2026-11-04'
    )
    expect(defaultGoal.rows[0]).toMatchObject({
      rate: 75, rateTone: 'good'
    })
    expect(defaultGoal.ticks[0].label).toBe('Nov 4')
  })
})
