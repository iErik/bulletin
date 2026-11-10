import { describe, expect, it } from 'vitest'
import { monthWeeks, weekdays, type Slot } from './month'

const SUNDAY = 0
const MONDAY = 1

/** Each week as day numbers, 0 for an empty slot. */
const numbers = (weeks: Slot[][]): number[][] =>
  weeks.map(week => week.map(day => day?.getDate() ?? 0))

// Months are 0-based.
describe('monthWeeks', () => {
  it('starts a month that begins on the first weekday', () => {
    // June 1st, 2026 is a Monday.
    const weeks = numbers(
      monthWeeks(new Date(2026, 5, 17), MONDAY)
    )

    expect(weeks[0]).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(weeks).toHaveLength(5)
    expect(weeks[4]).toEqual([29, 30, 0, 0, 0, 0, 0])
  })

  it('fits a 28-day month starting on Sunday in 4 rows', () => {
    // February 1st, 2026 is a Sunday.
    const weeks = numbers(
      monthWeeks(new Date(2026, 1, 1), SUNDAY)
    )

    expect(weeks).toHaveLength(4)
    expect(weeks[0]).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(weeks[3]).toEqual([22, 23, 24, 25, 26, 27, 28])
  })

  it('puts a Sunday 1st last with a Monday start', () => {
    const weeks = numbers(
      monthWeeks(new Date(2026, 1, 1), MONDAY)
    )

    expect(weeks[0]).toEqual([0, 0, 0, 0, 0, 0, 1])
    expect(weeks).toHaveLength(5)
    expect(weeks[4]).toEqual([23, 24, 25, 26, 27, 28, 0])
  })

  it.each([
    [MONDAY, [0, 1, 2, 3, 4, 5, 6], [28, 29, 0, 0, 0, 0, 0]],
    [SUNDAY, [0, 0, 1, 2, 3, 4, 5], [27, 28, 29, 0, 0, 0, 0]]
  ])(
    'includes February 29th in a leap year (start %i)',
    (start, first, last) => {
      // February 1st, 2028 is a Tuesday.
      const weeks = numbers(
        monthWeeks(new Date(2028, 1, 10), start)
      )

      expect(weeks).toHaveLength(5)
      expect(weeks[0]).toEqual(first)
      expect(weeks.at(-1)).toEqual(last)
    }
  )

  it.each([
    // March 1st, 2026 is a Sunday.
    [MONDAY, new Date(2026, 2, 1), [30, 31, 0, 0, 0, 0, 0]],
    // August 1st, 2026 is a Saturday.
    [SUNDAY, new Date(2026, 7, 1), [30, 31, 0, 0, 0, 0, 0]]
  ])(
    'uses 6 rows when the month needs them (start %i)',
    (start, month, last) => {
      const weeks = numbers(monthWeeks(month, start))

      expect(weeks).toHaveLength(6)
      expect(weeks[0]).toEqual([0, 0, 0, 0, 0, 0, 1])
      expect(weeks[5]).toEqual(last)
    }
  )

  it('gives days at local midnight in the month', () => {
    const days = monthWeeks(new Date(2026, 10, 9, 15), 1)
      .flat()
      .filter(day => day !== null)

    expect(days).toHaveLength(30)
    expect(days[0]).toEqual(new Date(2026, 10, 1))
    expect(days[29]).toEqual(new Date(2026, 10, 30))
  })
})

describe('weekdays', () => {
  it.each([
    [MONDAY, 1, 0],
    [SUNDAY, 0, 6]
  ])(
    'orders the columns from the week start (%i)',
    (start, first, last) => {
      const days = weekdays(start).map(day => day.getDay())

      expect(days).toHaveLength(7)
      expect(days[0]).toBe(first)
      expect(days[6]).toBe(last)
    }
  )
})
