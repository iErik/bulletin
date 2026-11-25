/**
 * Habits by Weekday calculations: each Habit's Completion
 * Rate per weekday over the 84 days ending on Selected Date.
 */
import { getDay, parseISO } from 'date-fns'
import type { Habit, HabitEntry } from '@shared/habits'
import type { DateRange, LocalDate } from '@shared/storage'
import { WEEKDAY_DAYS, type Weekday } from './overview'
import {
  countsOn,
  eachDay,
  ratePercent,
  shiftDay
} from './rules'

export const LOW_RATE_PERCENT = 35

export interface WeekdayCell {
  readonly weekday: Weekday
  readonly done: number
  readonly counted: number
  readonly rate: number | null
  readonly percent: number | null
  readonly low: boolean
}

export interface HabitWeekdayRow {
  readonly habit: Habit
  readonly cells: readonly WeekdayCell[]
}

/** 84-day (12-week) window ending on `selectedDate`. */
export const byWeekdayRange = (date: LocalDate): DateRange =>
  ({ from: shiftDay(date, 1 - WEEKDAY_DAYS), to: date })

/** Quadratic shading ramp: `0.05 + 0.80 × rate²`. */
export const cellOpacity = (rate: number): number => {
  const r = Math.min(1, Math.max(0, rate))
  return 0.05 + 0.80 * r * r
}

const byBoardOrder = (a: Habit, b: Habit): number =>
  Number(a.archived) - Number(b.archived)
  || (a.created < b.created ? -1 : a.created > b.created ? 1 : a.id - b.id)

/** Weekday Rates over 12 weeks in Habit Board order. */
export const habitsByWeekday = (
  habits: readonly Habit[],
  entries: readonly HabitEntry[],
  selectedDate: LocalDate,
  weekStartsOn: number
): HabitWeekdayRow[] => {
  const days = eachDay(byWeekdayRange(selectedDate)).map(
    day => ({ day, weekday: getDay(parseISO(day)) as Weekday })
  )
  const doneSet = new Set(entries.map(e => `${e.habitId}|${e.date}`))
  const start = ((weekStartsOn % 7) + 7) % 7
  const order = Array.from(
    { length: 7 }, (_, i) => ((start + i) % 7) as Weekday
  )
  return [...habits].sort(byBoardOrder).flatMap(habit => {
    const done = new Array<number>(7).fill(0)
    const counted = new Array<number>(7).fill(0)
    let total = 0
    for (const { day, weekday } of days) {
      if (!countsOn(habit, day, selectedDate)) continue
      counted[weekday] += 1
      total += 1
      if (doneSet.has(`${habit.id}|${day}`)) done[weekday] += 1
    }
    if (total === 0) return []
    return [{
      habit,
      cells: order.map((weekday): WeekdayCell => {
        const c = counted[weekday]
        const d = done[weekday]
        const rate = c === 0 ? null : d / c
        return {
          weekday, done: d, counted: c, rate,
          percent: rate === null ? null : ratePercent(rate),
          low: c > 0 && d * 100 < LOW_RATE_PERCENT * c
        }
      })
    }]
  })
}
