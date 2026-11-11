import { describe, expect, it } from 'vitest'
import { localDate } from './dates'

describe('localDate', () => {
  it('writes the local calendar date, padded', () => {
    expect(localDate(new Date(2026, 7, 2, 23, 59)))
      .toBe('2026-08-02')
    expect(localDate(new Date(2026, 0, 5)))
      .toBe('2026-01-05')
  })
})
