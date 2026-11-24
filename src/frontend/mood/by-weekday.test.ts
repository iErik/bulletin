import { addDays, parseISO } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { localDate } from '@shared/dates'
import type { MoodEntry, MoodKey } from '@shared/mood'
import {
  moodByWeekday,
  type WeekdayColumn
} from './by-weekday'
import { bestWeekday } from './overview'

// 2026-11-21 is a Saturday; its 90 days start on Aug 24.
const DATE = '2026-11-21'

const e = (date: string, mood: MoodKey): MoodEntry => ({ date, mood })

/** `moods.length` days, `step` days apart, from `start`. */
const series = (
  start: string,
  step: number,
  moods: readonly MoodKey[]
): MoodEntry[] => moods.map((mood, i) => ({
  date: localDate(addDays(parseISO(start), i * step)),
  mood
}))

const column = (
  result: ReturnType<typeof moodByWeekday>,
  weekday: number
): WeekdayColumn => result.columns.find(c => c.weekday === weekday)!

describe('moodByWeekday', () => {
  it('gives a weekday with 6 of 12 days Happy a half share', () => {
    // Twelve Mondays, back from Nov 16.
    const moods: MoodKey[] = [
      ...Array<MoodKey>(6).fill('happy'),
      ...Array<MoodKey>(6).fill('stressed')
    ]
    const result = moodByWeekday(
      series('2026-08-31', 7, moods), DATE, 1
    )
    const monday = column(result, 1)
    expect(monday.total).toBe(12)
    expect(monday.segments).toEqual([
      { mood: 'happy', count: 6, share: 0.5 },
      { mood: 'stressed', count: 6, share: 0.5 }
    ])
  })

  it('counts only the 90 days ending on the date', () => {
    const result = moodByWeekday([
      e('2026-08-23', 'angry'), // day 91
      e('2026-08-24', 'happy'), // day 90, a Monday
      e('2026-11-21', 'okay'), // the date, a Saturday
      e('2026-11-22', 'anxious') // after the date
    ], DATE, 1)
    expect(result.total).toBe(2)
    expect(column(result, 1).segments)
      .toEqual([{ mood: 'happy', count: 1, share: 1 }])
    expect(column(result, 6).segments)
      .toEqual([{ mood: 'okay', count: 1, share: 1 }])
    expect(column(result, 0).total).toBe(0)
  })

  it('starts the columns on the Locale’s first day', () => {
    const weekdays = (start: number): number[] =>
      moodByWeekday([], DATE, start).columns.map(c => c.weekday)
    expect(weekdays(0)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(weekdays(1)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(weekdays(6)).toEqual([6, 0, 1, 2, 3, 4, 5])
  })

  it('stacks segments in display order, skipping absent Moods', () => {
    // Six Saturdays, one per Mood, in picker order.
    const result = moodByWeekday(series('2026-10-17', 7, [
      'happy', 'okay', 'stressed', 'neutral', 'angry', 'anxious'
    ]), DATE, 1)
    expect(column(result, 6).segments.map(s => s.mood)).toEqual([
      'happy', 'okay', 'neutral', 'stressed', 'anxious', 'angry'
    ])

    const some = moodByWeekday(series('2026-10-17', 7, [
      'angry', 'happy', 'happy'
    ]), DATE, 1)
    expect(column(some, 6).segments).toEqual([
      { mood: 'happy', count: 2, share: 2 / 3 },
      { mood: 'angry', count: 1, share: 1 / 3 }
    ])
  })

  it('matches the Overview’s Best weekday', () => {
    // Saturday: 2 of 3 Happy; Friday: 1 of 2.
    const entries = [
      ...series('2026-10-31', 7, ['happy', 'happy', 'okay']),
      ...series('2026-11-06', 7, ['happy', 'stressed'])
    ]
    for (const start of [0, 1, 6]) {
      expect(moodByWeekday(entries, DATE, start).best)
        .toBe(bestWeekday(entries, DATE, start)?.weekday)
    }
    expect(moodByWeekday(entries, DATE, 1).best).toBe(6)
  })

  it('breaks a tie on the first weekday in week order', () => {
    // Sunday and Monday are both all Happy.
    const entries = [
      e('2026-11-15', 'happy'), e('2026-11-16', 'happy')
    ]
    expect(moodByWeekday(entries, DATE, 0).best).toBe(0)
    expect(moodByWeekday(entries, DATE, 1).best).toBe(1)
  })

  it('has no best weekday without a Happy day', () => {
    const result = moodByWeekday(
      [e('2026-11-16', 'okay'), e('2026-11-17', 'angry')], DATE, 1
    )
    expect(result.best).toBeNull()
    expect(result.total).toBe(2)
  })

  it('returns empty columns with no logged days', () => {
    const result = moodByWeekday([], DATE, 1)
    expect(result.total).toBe(0)
    expect(result.best).toBeNull()
    expect(result.columns).toHaveLength(7)
    for (const c of result.columns) {
      expect(c.total).toBe(0)
      expect(c.segments).toEqual([])
    }
  })
})
