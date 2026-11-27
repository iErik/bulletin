import { describe, expect, it } from 'vitest'
import type {
  DueReminder,
  ReminderOffset
} from '@shared/reminders'
import type { Task } from '@shared/tasks'
import { useFixedToday } from '@/testing/clock'
import {
  REMINDERS_WINDOW_DAYS,
  reminderLabel,
  reminderText,
  reminderWindow
} from './reminders'

// Nov 9th 2026 is a Monday (en-US week starts Sun).
const NOW = new Date(2026, 10, 9, 9, 0)

const task = (
  title: string,
  offset: ReminderOffset | null = null
): Task => ({
  id: 1,
  title,
  day: '2026-11-09',
  time: '10:00',
  reminder: offset,
  doneAt: null,
  created: 0,
  moves: 0
})

const reminder = (
  offset: ReminderOffset,
  title = 'Dentist'
): Extract<DueReminder, { kind: 'task' }> => ({
  kind: 'task',
  task: task(title, offset),
  offset,
  dueAt: 0,
  notifiedAt: null
})

describe('reminders', () => {
  useFixedToday()

  it('opens the window from now to 7 days later', () => {
    const now = new Date(2026, 10, 9, 9, 0)
    const { from, to } = reminderWindow(now)

    expect(from).toBe(now.getTime())
    expect(to).toBe(
      now.getTime() + REMINDERS_WINDOW_DAYS * 24 * 60 * 60 * 1000
    )
  })

  it('labels the soonest entries Today and Tomorrow', () => {
    expect(reminderLabel(
      new Date(2026, 10, 9, 9, 30).getTime(), NOW)
    ).toBe('Today 09:30')
    expect(reminderLabel(
      new Date(2026, 10, 10, 11, 0).getTime(), NOW)
    ).toBe('Tomorrow 11:00')
  })

  it('labels later entries with the weekday', () => {
    expect(reminderLabel(
      new Date(2026, 10, 12, 18, 0).getTime(), NOW)
    ).toBe('Thu 18:00')
  })

  it('shows the offset in the text', () => {
    expect(reminderText(reminder({
      kind: 'minutes', minutes: 30
    }))).toBe('Dentist in 30 min')
    expect(reminderText(reminder({
      kind: 'minutes', minutes: 0
    }))).toBe('Dentist now')
    expect(reminderText(reminder({
      kind: 'days', days: 2, time: '18:00'
    }))).toBe('Dentist (2 days before)')
  })

  it('singularizes a one-day offset', () => {
    expect(reminderText(reminder({
      kind: 'days', days: 1, time: '18:00'
    }))).toBe('Dentist (1 day before)')
  })

  it('ignores Occurrences', () => {
    const occurrence: DueReminder = {
      kind: 'occurrence',
      occurrence: {
        ruleId: 1,
        scheduled: '2026-11-09',
        title: 'Recurring',
        day: '2026-11-09',
        time: null,
        reminder: null,
        doneAt: null,
        moves: 0,
        created: 0
      },
      offset: { kind: 'minutes', minutes: 30 },
      dueAt: 0,
      notifiedAt: null
    }

    expect(reminderText(occurrence)).toBe('')
  })
})
