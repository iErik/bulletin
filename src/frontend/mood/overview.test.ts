import { addDays, parseISO } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { localDate } from '@shared/dates'
import type { MoodEntry, MoodKey } from '@shared/mood'
import {
  bestWeekday,
  goodStreak,
  logged,
  longestAnxiousRun,
  moodMix,
  mostCommon,
  mostImproved,
  stressedDays,
  toughestWeekday,
  wholePercent
} from './overview'

const e = (date: string, mood: MoodKey): MoodEntry => ({ date, mood })

const run = (start: string, days: number, mood: MoodKey): MoodEntry[] =>
  Array.from({ length: days }, (_, i) => ({
    date: localDate(addDays(parseISO(start), i)),
    mood
  }))

describe('wholePercent', () => {
  it('floors shares and handles exact and negative values', () => {
    expect(wholePercent(288 / 325)).toBe(88)
    expect(wholePercent(0.889)).toBe(88)
    expect(wholePercent(0)).toBe(0)
    expect(wholePercent(1)).toBe(100)
    expect(wholePercent(29 / 100)).toBe(29)
    expect(wholePercent(57 / 100)).toBe(57)
    expect(wholePercent(1 / 10)).toBe(10)
    expect(wholePercent(-0.068)).toBe(-6)
    expect(wholePercent(-29 / 100)).toBe(-29)
    expect(Object.is(wholePercent(-0.005), 0)).toBe(true)
  })
})

describe('mostCommon', () => {
  it('handles empty YTD, top Mood and Mood-order ties', () => {
    expect(mostCommon(
      [e('2025-12-31', 'happy'), e('2026-06-16', 'happy')], '2026-06-15'
    )).toBeNull()

    const entries = [
      e('2025-12-31', 'anxious'), e('2026-01-01', 'okay'),
      e('2026-01-02', 'happy'), e('2026-01-03', 'happy'),
      e('2026-01-04', 'stressed'), e('2026-01-05', 'anxious')
    ]
    expect(mostCommon(entries, '2026-01-04'))
      .toEqual({ mood: 'happy', count: 2, share: 0.5 })

    const tied = [
      e('2026-02-01', 'anxious'), e('2026-02-02', 'stressed'),
      e('2026-02-03', 'angry'), e('2026-02-04', 'okay')
    ]
    expect(mostCommon(tied, '2026-02-04')?.mood).toBe('okay')
  })
})

describe('goodStreak', () => {
  it('runs across Dec 31 (7 days on Jan 3) and ignores future', () => {
    const entries = [
      e('2025-12-27', 'stressed'),
      ...run('2025-12-28', 4, 'happy'),
      ...run('2026-01-01', 3, 'okay'),
      e('2026-01-04', 'happy')
    ]
    expect(goodStreak(entries, '2026-01-03')).toBe(7)
  })

  it('handles empty, Neutral/Hard today, gaps and Feb 29', () => {
    const base = run('2026-03-01', 3, 'happy')
    expect(goodStreak(base, '2026-03-04')).toBe(3)
    expect(goodStreak([...base, e('2026-03-04', 'neutral')], '2026-03-04'))
      .toBe(0)
    expect(goodStreak([...base, e('2026-03-04', 'stressed')], '2026-03-04'))
      .toBe(0)
    expect(goodStreak([
      e('2024-02-26', 'happy'), e('2024-02-28', 'okay'),
      e('2024-02-29', 'happy'), e('2024-03-01', 'okay')
    ], '2024-03-01')).toBe(3)
  })
})

describe('logged', () => {
  it('shows 88% on Nov 21 with 288 days and handles leap/empty', () => {
    const result = logged(run('2026-01-01', 288, 'happy'), '2026-11-21')
    expect(result).toEqual({ logged: 288, total: 325, share: 288 / 325 })
    expect(wholePercent(result.share)).toBe(88)

    expect(logged([
      e('2023-12-31', 'happy'),
      e('2024-02-29', 'okay'),
      e('2024-03-02', 'happy')
    ], '2024-03-01')).toEqual({ logged: 1, total: 61, share: 1 / 61 })
    expect(logged([], '2026-01-01'))
      .toEqual({ logged: 0, total: 1, share: 0 })
  })
})

describe('moodMix', () => {
  it('compares Mar 1-31 vs Feb 1-28 in Mood order, 10% flag', () => {
    const mix = moodMix([
      e('2026-02-01', 'anxious'), e('2026-02-28', 'happy'),
      e('2026-03-01', 'stressed'), e('2026-03-31', 'happy'),
      e('2026-04-01', 'angry')
    ], '2026-03-31')
    expect(mix.current).toEqual({
      range: { from: '2026-03-01', to: '2026-03-31' },
      total: 2,
      segments: [
        { mood: 'happy', count: 1, share: 0.5, showPercent: true },
        { mood: 'stressed', count: 1, share: 0.5, showPercent: true }
      ]
    })
    expect(mix.previous).toEqual({
      range: { from: '2026-02-01', to: '2026-02-28' },
      total: 2,
      segments: [
        { mood: 'happy', count: 1, share: 0.5, showPercent: true },
        { mood: 'anxious', count: 1, share: 0.5, showPercent: true }
      ]
    })

    const ten = [...run('2026-05-01', 9, 'happy'), e('2026-05-10', 'anxious')]
    expect(moodMix(ten, '2026-05-10').current.segments[1].showPercent)
      .toBe(true)
    expect(moodMix([...ten, e('2026-05-11', 'happy')], '2026-05-11')
      .current.segments[1].showPercent).toBe(false)
    expect(moodMix(ten, '2026-05-10').previous.segments).toEqual([])
  })
})

describe('bestWeekday', () => {
  // 2026-11-21 is Saturday; 90-day window starts 2026-08-24.
  it('picks highest Happy share, breaks ties by week order', () => {
    const entries = [
      e('2026-08-23', 'happy'), e('2026-11-08', 'stressed'),
      e('2026-11-09', 'happy'), e('2026-11-16', 'okay'),
      e('2026-11-14', 'happy'), e('2026-11-21', 'happy'),
      e('2026-11-22', 'happy')
    ]
    expect(bestWeekday(entries, '2026-11-21', 0))
      .toEqual({ weekday: 6, mood: 'happy', share: 1 })

    const tied = [e('2026-11-08', 'happy'), e('2026-11-09', 'happy')]
    expect(bestWeekday(tied, '2026-11-21', 0)?.weekday).toBe(0)
    expect(bestWeekday(tied, '2026-11-21', 1)?.weekday).toBe(1)
    expect(bestWeekday([], '2026-11-21', 0)).toBeNull()
    expect(bestWeekday([e('2026-11-09', 'okay')], '2026-11-21', 0))
      .toBeNull()
  })
})

describe('toughestWeekday', () => {
  it('never names Neutral/Happy/Okay and breaks ties properly', () => {
    expect(toughestWeekday([
      e('2026-11-08', 'neutral'), e('2026-11-09', 'happy'),
      e('2026-11-10', 'okay')
    ], '2026-11-21', 0)).toBeNull()

    const entries = [
      e('2026-11-02', 'happy'), e('2026-11-09', 'stressed'),
      e('2026-11-16', 'stressed'), e('2026-11-10', 'anxious'),
      e('2026-11-17', 'happy')
    ]
    expect(toughestWeekday(entries, '2026-11-21', 1))
      .toEqual({ weekday: 1, mood: 'stressed', share: 2 / 3 })

    const cross = [e('2026-11-08', 'anxious'), e('2026-11-09', 'stressed')]
    expect(toughestWeekday(cross, '2026-11-21', 0))
      .toEqual({ weekday: 0, mood: 'anxious', share: 1 })
    expect(toughestWeekday(cross, '2026-11-21', 1))
      .toEqual({ weekday: 1, mood: 'stressed', share: 1 })

    const sameDay = [
      e('2026-11-02', 'anxious'),
      e('2026-11-09', 'angry'),
      e('2026-11-16', 'stressed')
    ]
    expect(toughestWeekday(sameDay, '2026-11-21', 1))
      .toEqual({ weekday: 1, mood: 'stressed', share: 1 / 3 })
  })
})

describe('stressedDays', () => {
  it('tracks count and delta vs same span last month', () => {
    const down = [
      e('2026-02-05', 'stressed'), e('2026-02-10', 'stressed'),
      e('2026-02-28', 'stressed'), e('2026-03-02', 'stressed'),
      e('2026-03-10', 'happy'), e('2026-04-01', 'stressed')
    ]
    expect(stressedDays(down, '2026-03-31'))
      .toEqual({ count: 1, previous: 3, delta: -2 })
    expect(stressedDays([
      e('2026-04-02', 'stressed'),
      e('2026-05-01', 'stressed'), e('2026-05-02', 'stressed')
    ], '2026-05-05')).toEqual({ count: 2, previous: 1, delta: 1 })
    expect(stressedDays([e('2026-05-01', 'happy')], '2026-05-05'))
      .toEqual({ count: 0, previous: 0, delta: 0 })
    expect(stressedDays([e('2026-04-02', 'stressed')], '2026-05-05'))
      .toBeNull()
  })
})

describe('longestAnxiousRun', () => {
  it('clips to 90 days, hides <2, prefers recent, crosses Jan 1', () => {
    expect(longestAnxiousRun([e('2026-11-10', 'anxious')], '2026-11-21'))
      .toBeNull()
    expect(longestAnxiousRun(
      [e('2026-08-23', 'anxious'), e('2026-08-24', 'anxious')], '2026-11-21'
    )).toBeNull()
    expect(longestAnxiousRun([
      ...run('2026-08-22', 4, 'anxious'),
      e('2026-11-21', 'anxious'), e('2026-11-22', 'anxious')
    ], '2026-11-21')).toEqual({
      from: '2026-08-24', to: '2026-08-25', days: 2
    })
    expect(longestAnxiousRun([
      ...run('2025-12-30', 3, 'anxious'),
      ...run('2026-01-10', 3, 'anxious')
    ], '2026-01-20')).toEqual({
      from: '2026-01-10', to: '2026-01-12', days: 3
    })
    expect(longestAnxiousRun(run('2024-02-28', 3, 'anxious'), '2024-03-10'))
      .toEqual({ from: '2024-02-28', to: '2024-03-01', days: 3 })
  })
})

describe('mostImproved', () => {
  it('picks Good up or Hard down, ties by Mood order, hides none', () => {
    expect(mostImproved([
      e('2026-02-01', 'happy'), ...run('2026-02-02', 3, 'neutral'),
      ...run('2026-03-01', 3, 'happy'), e('2026-03-04', 'neutral')
    ], '2026-03-31')).toEqual({
      mood: 'happy',
      delta: 0.5,
      comparedTo: { from: '2026-02-01', to: '2026-02-28' }
    })
    expect(mostImproved([
      ...run('2026-04-01', 2, 'stressed'), ...run('2026-04-03', 2, 'neutral'),
      e('2026-05-01', 'stressed'), ...run('2026-05-02', 3, 'neutral')
    ], '2026-05-10')).toEqual({
      mood: 'stressed',
      delta: -0.25,
      comparedTo: { from: '2026-04-01', to: '2026-04-10' }
    })
    expect(mostImproved([
      e('2026-04-01', 'stressed'), e('2026-04-02', 'anxious'),
      e('2026-05-01', 'okay'), e('2026-05-02', 'neutral')
    ], '2026-05-10')).toEqual({
      mood: 'okay',
      delta: 0.5,
      comparedTo: { from: '2026-04-01', to: '2026-04-10' }
    })
    expect(mostImproved([e('2026-05-01', 'happy')], '2026-05-10')).toBeNull()
    expect(mostImproved([e('2026-04-01', 'happy')], '2026-05-10')).toBeNull()
    expect(mostImproved(
      [e('2026-04-01', 'happy'), e('2026-05-01', 'stressed')], '2026-05-10'
    )).toBeNull()
    expect(mostImproved(
      [e('2026-04-01', 'neutral'), e('2026-05-01', 'neutral')], '2026-05-10'
    )).toBeNull()
    // Sub-1-point shift (1/21 vs 1/20 = +0.24pp) floors to 0, so hide.
    expect(mostImproved([
      e('2026-04-01', 'happy'), ...run('2026-04-02', 20, 'neutral'),
      e('2026-05-01', 'happy'), ...run('2026-05-02', 19, 'neutral')
    ], '2026-05-21')).toBeNull()
  })
})
