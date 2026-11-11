import { afterEach, beforeEach, describe, expect, it }
  from 'vitest'
import { setLocaleOverride } from '@/locale/format'
import { caption, formatDuration } from './caption'

const at = (day: number, h: number, m = 0): number =>
  new Date(2026, 10, day, h, m).getTime()

// Intl separates some parts with no-break spaces.
const plain = (text: string): string =>
  text.replace(/[  ]/g, ' ')

describe('caption', () => {
  beforeEach(() => setLocaleOverride('en-US'))
  afterEach(() => setLocaleOverride(null))

  it('is empty without Periods', () => {
    expect(caption([])).toBe('')
  })

  it("shows one Period's start and end", () => {
    const night = { id: 1, start: at(8, 2, 10), end: at(8, 11, 10) }

    expect(plain(caption([night])))
      .toBe('2:10 AM to 11:10 AM')
  })

  it("uses the Locale's clock", () => {
    setLocaleOverride('pt-BR')
    const night = { id: 1, start: at(7, 23), end: at(8, 7) }

    expect(plain(caption([night]))).toBe('23:00 to 7:00')
  })

  it('totals and counts several Periods', () => {
    expect(caption([
      { id: 1, start: at(8, 0), end: at(8, 6, 30) },
      { id: 2, start: at(8, 8), end: at(8, 9, 35) }
    ])).toBe('8h 05m · 2 periods')
  })

  it('writes durations in hours and minutes', () => {
    expect(formatDuration(0)).toBe('0h 00m')
    expect(formatDuration(24 * 3_600_000))
      .toBe('24h 00m')
  })
})
