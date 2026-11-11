import { describe, expect, it } from 'vitest'
import type { Habit } from '@shared/habits'
import {
  CURRENT_HABIT_KEY,
  pickCurrentHabit,
  readCurrentHabit,
  writeCurrentHabit
} from './current-habit'

const habit = (id: number): Habit => ({
  id,
  name: `Habit ${id}`,
  icon: 'reading',
  created: '2026-01-01',
  archived: false
})

describe('current Habit', () => {
  it('remembers the id', () => {
    writeCurrentHabit(7)

    expect(localStorage.getItem(CURRENT_HABIT_KEY))
      .toBe('7')
    expect(readCurrentHabit()).toBe(7)
  })

  it.each([null, '', 'abc', '1.5'])(
    'reads %j as no id',
    value => {
      if (value !== null)
        localStorage.setItem(CURRENT_HABIT_KEY, value)

      expect(readCurrentHabit()).toBeNull()
    }
  )

  it('picks the Habit with the id', () => {
    expect(pickCurrentHabit([habit(1), habit(2)], 2))
      .toEqual(habit(2))
  })

  it.each([null, 3])(
    'falls back to the oldest for id %j',
    id => {
      expect(pickCurrentHabit([habit(1), habit(2)], id))
        .toEqual(habit(1))
    }
  )

  it('picks nothing without Habits', () => {
    expect(pickCurrentHabit([], 1)).toBeNull()
  })
})
