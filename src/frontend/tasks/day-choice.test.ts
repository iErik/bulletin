import { describe, expect, it } from 'vitest'
import { setLocaleOverride } from '@/locale/format'
import { today, useFixedToday } from '@/testing/clock'
import {
  choiceOf,
  dateOf,
  dayOf,
  parseTime,
  timeText
} from './day-choice'

// Today is November 9th, 2026.
describe('choiceOf', () => {
  it.each([
    [null, 'someday'],
    ['2026-11-09', 'today'],
    ['2026-11-10', 'tomorrow'],
    ['2026-11-08', 'date'],
    ['2026-11-11', 'date']
  ] as const)('matches %s to %s', (day, choice) => {
    expect(choiceOf(day, today)).toBe(choice)
  })

  it('crosses a month end', () => {
    expect(choiceOf('2026-12-01', new Date(2026, 10, 30)))
      .toBe('tomorrow')
  })
})

describe('dayOf', () => {
  it.each([
    ['today', '2026-11-09'],
    ['tomorrow', '2026-11-10'],
    ['someday', null]
  ] as const)('plans %s on %s', (choice, day) => {
    expect(dayOf(choice, today)).toBe(day)
  })

  it('crosses a year end', () => {
    expect(dayOf('tomorrow', new Date(2026, 11, 31)))
      .toBe('2027-01-01')
  })
})

describe('dateOf', () => {
  it('is local midnight on the day', () => {
    expect(dateOf('2027-02-03'))
      .toEqual(new Date(2027, 1, 3))
  })
})

describe('parseTime', () => {
  it.each([
    ['14:20', '14:20'],
    ['9:05', '09:05'],
    ['9', '09:00'],
    ['2:20 pm', '14:20'],
    ['12 am', '00:00'],
    [' 07.30 ', '07:30']
  ])('reads "%s" as %s', (text, time) => {
    expect(parseTime(text)).toBe(time)
  })

  it.each(['', '   '])('reads "%s" as any time', text => {
    expect(parseTime(text)).toBeNull()
  })

  it.each(['24:00', '9:60', '13 pm', 'soon'])(
    'rejects "%s"',
    text => {
      expect(parseTime(text)).toBeUndefined()
    }
  )
})

describe('timeText', () => {
  useFixedToday()

  it('shows any time as blank', () => {
    expect(timeText(null)).toBe('')
  })

  it('follows the Locale\'s clock', () => {
    expect(timeText('14:05')).toBe('2:05 PM')

    setLocaleOverride('pt-BR')
    expect(timeText('14:05')).toBe('14:05')
  })

  it('reads back what it shows', () => {
    expect(parseTime(timeText('00:30'))).toBe('00:30')
  })
})
