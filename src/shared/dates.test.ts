import { describe, expect, it } from 'vitest'
import { localDate, sameSpanLastMonth } from './dates'

describe('localDate', () => {
  it('writes the local calendar date, padded', () => {
    expect(localDate(new Date(2026, 7, 2, 23, 59)))
      .toBe('2026-08-02')
    expect(localDate(new Date(2026, 0, 5)))
      .toBe('2026-01-05')
  })
})

describe('sameSpanLastMonth', () => {
  it.each([
    ['2026-11-21', '2026-10-01', '2026-10-21'],
    ['2026-06-01', '2026-05-01', '2026-05-01'],
    ['2026-03-31', '2026-02-01', '2026-02-28'],
    ['2026-03-29', '2026-02-01', '2026-02-28'],
    ['2024-03-31', '2024-02-01', '2024-02-29'],
    ['2024-02-29', '2024-01-01', '2024-01-29'],
    ['2026-05-31', '2026-04-01', '2026-04-30'],
    ['2026-01-15', '2025-12-01', '2025-12-15'],
    ['2026-01-31', '2025-12-01', '2025-12-31']
  ])('maps %s to %s..%s', (date, from, to) => {
    expect(sameSpanLastMonth(date)).toEqual({ from, to })
  })
})
