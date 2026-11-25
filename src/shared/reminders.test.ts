import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REMINDER_TIME,
  reminderDueAt,
  type ReminderOffset
} from './reminders'

const at = (
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number
): number => new Date(y, m - 1, d, hh, mm).getTime()

describe('reminderDueAt', () => {
  it.each([
    [0, 10, 0],
    [15, 9, 45],
    [30, 9, 30],
    [60, 9, 0]
  ] as const)(
    'computes %i min before 10:00',
    (minutes, hh, mm) => {
      expect(reminderDueAt('2026-11-26', '10:00', {
        kind: 'minutes', minutes
      })).toBe(at(2026, 11, 26, hh, mm))
    }
  )

  it('uses 09:00 as base when the Task has no time', () => {
    expect(DEFAULT_REMINDER_TIME).toBe('09:00')
    expect(reminderDueAt('2026-11-26', null, {
      kind: 'minutes', minutes: 0
    })).toBe(at(2026, 11, 26, 9, 0))
    expect(reminderDueAt('2026-11-26', null, {
      kind: 'minutes', minutes: 30
    })).toBe(at(2026, 11, 26, 8, 30))
  })

  it('crosses midnight backwards for early-morning Tasks',
    () => {
      expect(reminderDueAt('2026-11-26', '00:15', {
        kind: 'minutes', minutes: 30
      })).toBe(at(2026, 11, 25, 23, 45))
      expect(reminderDueAt('2026-01-01', '00:00', {
        kind: 'minutes', minutes: 60
      })).toBe(at(2025, 12, 31, 23, 0))
    })

  it('computes 1 and 2 days before at chosen time', () => {
    const oneDay: ReminderOffset = {
      kind: 'days', days: 1, time: '18:00'
    }
    const twoDays: ReminderOffset = {
      kind: 'days', days: 2, time: '18:00'
    }
    expect(reminderDueAt('2026-11-26', '10:00', oneDay))
      .toBe(at(2026, 11, 25, 18, 0))
    expect(reminderDueAt('2026-11-26', null, oneDay))
      .toBe(at(2026, 11, 25, 18, 0))
    expect(reminderDueAt('2026-11-26', '10:00', twoDays))
      .toBe(at(2026, 11, 24, 18, 0))
  })

  it('handles month, leap-year and year rollovers', () => {
    expect(reminderDueAt('2026-03-01', null, {
      kind: 'days', days: 2, time: '18:00'
    })).toBe(at(2026, 2, 27, 18, 0))
    expect(reminderDueAt('2024-03-01', null, {
      kind: 'days', days: 1, time: '09:00'
    })).toBe(at(2024, 2, 29, 9, 0))
    expect(reminderDueAt('2026-01-01', null, {
      kind: 'days', days: 1, time: '20:00'
    })).toBe(at(2025, 12, 31, 20, 0))
  })
})
