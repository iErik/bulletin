import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest'
import { setLocaleOverride } from '@/locale/format'
import {
  REMINDERS_WINDOW_DAYS,
  reminderLabel,
  reminderWindow
} from './reminders'

// Nov 9th 2026 is a Monday (en-US week starts Sun).
const NOW = new Date(2026, 10, 9, 9, 0)

describe('reminders', () => {
  beforeEach(() => setLocaleOverride('en-US'))
  afterEach(() => setLocaleOverride(null))

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
    ).toBe('Today 9:30 AM')
    expect(reminderLabel(
      new Date(2026, 10, 10, 11, 0).getTime(), NOW)
    ).toBe('Tomorrow 11:00 AM')
  })

  it('labels later entries with the weekday', () => {
    expect(reminderLabel(
      new Date(2026, 10, 12, 18, 0).getTime(), NOW)
    ).toBe('Thu 6:00 PM')
  })

  it('labels a Reminder 7 days out on the same weekday with the weekday', () => {
    expect(reminderLabel(
      new Date(2026, 10, 16, 10, 0).getTime(), NOW)
    ).toBe('Mon 10:00 AM')
  })

  it('keeps the midnight hour on the clock', () => {
    expect(reminderLabel(
      new Date(2026, 10, 9, 0, 5).getTime(), NOW)
    ).toBe('Today 12:05 AM')
  })

  it('labels a Reminder on the first of the next month as Tomorrow', () => {
    const dec31 = new Date(2026, 11, 31, 15, 0)
    expect(reminderLabel(
      new Date(2027, 0, 1, 9, 0).getTime(), dec31)
    ).toBe('Tomorrow 9:00 AM')
  })

  it('formats the clock in the Locale', () => {
    setLocaleOverride('pt-BR')

    expect(reminderLabel(
      new Date(2026, 10, 9, 9, 30).getTime(), NOW)
    ).toBe('Today 9:30')
    expect(reminderLabel(
      new Date(2026, 10, 12, 18, 0).getTime(), NOW)
    ).toBe('qui. 18:00')
  })
})
