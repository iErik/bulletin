import { addDays, parseISO } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { localDate } from '@shared/dates'
import type { MoodEntry, MoodKey } from '@shared/mood'
import { wholePercent } from './overview'
import { yearInMood } from './year'

const e = (date: string, mood: MoodKey): MoodEntry =>
  ({ date, mood })

const run = (
  start: string,
  days: number,
  mood: MoodKey
): MoodEntry[] =>
  Array.from({ length: days }, (_, i) => ({
    date: localDate(addDays(parseISO(start), i)),
    mood
  }))

describe('yearInMood', () => {
  it('counts logged days out of elapsed ones', () => {
    // 288 of the 325 days from Jan 1 to Nov 21 2026.
    const entries = run('2026-01-01', 288, 'okay')

    const year = yearInMood(entries, '2026-11-21')

    expect(year.year).toBe(2026)
    expect(year.logged).toBe(288)
    expect(year.elapsed).toBe(325)
  })

  it('gives a month’s Happy share of its logged days',
    () => {
      const entries = [
        ...run('2026-03-01', 4, 'happy'),
        ...run('2026-03-05', 6, 'stressed')
      ]

      const march = yearInMood(entries, '2026-11-21')
        .months[2]

      expect(march.logged).toBe(10)
      expect(march.happyShare).toBe(0.4)
      expect(wholePercent(march.happyShare ?? 0)).toBe(40)
    })

  it('has no Happy share for a month with no Moods',
    () => {
      const year = yearInMood(
        [e('2026-01-05', 'okay')],
        '2026-11-21'
      )

      expect(year.months[0].happyShare).toBe(0)
      expect(year.months[1]).toEqual({
        month: 1, logged: 0, happyShare: null, mix: []
      })
    })

  it('mixes Moods in display order, without empty ones',
    () => {
      const entries = [
        e('2026-04-01', 'angry'),
        e('2026-04-02', 'stressed'),
        e('2026-04-03', 'neutral'),
        e('2026-04-04', 'happy')
      ]

      const april = yearInMood(entries, '2026-11-21')
        .months[3]

      expect(april.mix).toEqual([
        { mood: 'happy', count: 1, share: 0.25 },
        { mood: 'neutral', count: 1, share: 0.25 },
        { mood: 'stressed', count: 1, share: 0.25 },
        { mood: 'angry', count: 1, share: 0.25 }
      ])
    })

  it('ignores Entries after the Selected Date', () => {
    const entries = [
      e('2026-11-20', 'happy'),
      e('2026-11-21', 'happy'),
      e('2026-11-22', 'angry'),
      e('2026-12-01', 'angry')
    ]

    const year = yearInMood(entries, '2026-11-21')

    expect(year.logged).toBe(2)
    expect(year.months[10].mix).toEqual([
      { mood: 'happy', count: 2, share: 1 }
    ])
    expect(year.months[11].logged).toBe(0)
  })

  it('shows only the Selected Date’s year', () => {
    const entries = [
      e('2024-12-31', 'angry'),
      e('2025-02-10', 'happy'),
      e('2025-06-01', 'okay'),
      e('2026-01-01', 'angry')
    ]

    const year = yearInMood(entries, '2025-06-01')

    expect(year.year).toBe(2025)
    expect(year.logged).toBe(2)
    // Jan 1 to Jun 1 2025.
    expect(year.elapsed).toBe(152)
    expect(year.months[0].logged).toBe(0)
    expect(year.months[1].happyShare).toBe(1)
    expect(year.months[5].happyShare).toBe(0)
    expect(year.months).toHaveLength(12)
  })
})
