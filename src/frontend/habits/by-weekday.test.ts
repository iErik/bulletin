import { describe, expect, it } from 'vitest'
import type {
  ArchivePeriod,
  Habit,
  HabitEntry
} from '@shared/habits'
import type { LocalDate } from '@shared/storage'
import {
  byWeekdayRange,
  cellOpacity,
  habitsByWeekday
} from './by-weekday'
import { eachDay } from './rules'

const habit = (
  id: number,
  created: LocalDate = '2025-01-01',
  archivePeriods: ArchivePeriod[] = []
): Habit => ({
  id, name: `Habit ${id}`, icon: 'exercise', created,
  archived: archivePeriods.some(p => p.end === null),
  archivePeriods
})
const doneDays = (id: number, days: readonly LocalDate[]): HabitEntry[] =>
  days.map(date => ({ habitId: id, date }))

const SELECTED: LocalDate = '2026-11-13' // Friday
const FRIDAYS = eachDay(byWeekdayRange(SELECTED))
  .filter(d => new Date(`${d}T00:00`).getDay() === 5)

describe('byWeekdayRange & cellOpacity', () => {
  it('spans 84 days and applies quadratic opacity ramp', () => {
    const range = byWeekdayRange(SELECTED)
    expect(range).toEqual({ from: '2026-08-22', to: SELECTED })
    expect(eachDay(range)).toHaveLength(84)
    expect([0, 0.25, 0.5, 1, -1, 2].map(r => Number(cellOpacity(r).toFixed(4))))
      .toEqual([0.05, 0.1, 0.25, 0.85, 0.05, 0.85])
  })
})

describe('habitsByWeekday', () => {
  it('scores 3/12 Fridays as 25% + low and clears >= 35%', () => {
    const h = habit(1)
    const [r3] = habitsByWeekday(
      [h], doneDays(1, FRIDAYS.slice(0, 3)), SELECTED, 1
    )
    expect(r3.cells[4]).toEqual({
      weekday: 5, done: 3, counted: 12,
      rate: 0.25, percent: 25, low: true
    })
    expect(r3.cells[0]).toMatchObject({ done: 0, counted: 12, low: true })
    expect(habitsByWeekday(
      [h], doneDays(1, FRIDAYS.slice(0, 4)), SELECTED, 1
    )[0].cells[4]).toMatchObject({ percent: 33, low: true })
    expect(habitsByWeekday(
      [h], doneDays(1, FRIDAYS.slice(0, 5)), SELECTED, 1
    )[0].cells[4]).toMatchObject({ percent: 42, low: false })
  })

  it('counts only existing weeks and leaves uncounted null', () => {
    const [row] = habitsByWeekday(
      [habit(1, '2026-10-24')],
      doneDays(1, ['2026-10-16', ...FRIDAYS.slice(-2)]),
      SELECTED, 1
    )
    expect(row.cells[4]).toMatchObject({
      done: 2, counted: 3, percent: 67, low: false
    })
    const [short] = habitsByWeekday(
      [habit(2, '2026-11-12')], doneDays(2, ['2026-11-12']), SELECTED, 1
    )
    expect(short.cells[0]).toMatchObject({
      counted: 0, rate: null, percent: null, low: false
    })
    expect(short.cells[3]).toMatchObject({ done: 1, counted: 1 })
  })

  it('excludes Archive Periods and out-of-window entries', () => {
    const h = habit(1, '2025-01-01', [
      { start: '2026-09-01', end: '2026-09-30' }
    ])
    const entries = doneDays(1, [
      '2026-08-21', '2026-09-04', '2026-09-11', '2026-11-14',
      ...FRIDAYS.filter(d => d >= '2026-10-01').slice(0, 3)
    ])
    expect(habitsByWeekday([h], entries, SELECTED, 1)[0].cells[4])
      .toMatchObject({ done: 3, counted: 8, percent: 38, low: false })
  })

  it('orders columns by weekStartsOn and rows in Board order', () => {
    const habits = [
      habit(4, '2026-01-01', [{ start: '2026-10-01', end: null }]),
      habit(3, '2026-02-01'),
      habit(2, '2026-01-01'),
      habit(1, '2026-01-01'),
      habit(5, '2025-01-01', [{ start: '2026-01-01', end: null }]),
      habit(6, '2026-12-01')
    ]
    const sun = habitsByWeekday(habits, [], SELECTED, 0)
    const mon = habitsByWeekday(habits, [], SELECTED, 1)
    expect(sun.map(r => r.habit.id)).toEqual([1, 2, 3, 4])
    expect([sun, mon].map(r => r[0].cells.map(c => c.weekday)))
      .toEqual([[0, 1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6, 0]])
  })
})
