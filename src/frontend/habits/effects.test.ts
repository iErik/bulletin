import { getDay, parseISO } from 'date-fns'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest'
import type { Transaction } from '@shared/expenses'
import type {
  ArchivePeriod,
  Habit,
  HabitEntry
} from '@shared/habits'
import type { MoodEntry, MoodKey } from '@shared/mood'
import type { SleepPeriod } from '@shared/sleep'
import type { LocalDate } from '@shared/storage'
import { setLocaleOverride } from '@/locale/format'
import { last90Range } from '@/mood/overview'
import {
  calendarEffect,
  expensesEffect,
  formatSleepEffect,
  moodEffect,
  sleepEffect
} from './effects'
import { eachDay, shiftDay } from './rules'

/** Selected Date: Thursday, Nov 19, 2026 (WINDOW[0] is Saturday). */
const DATE = '2026-11-19'
const WINDOW = eachDay(last90Range(DATE))
const MINUTE = 60_000
const HOUR = 60 * MINUTE

const plain = (text: string): string =>
  text.replace(/[\u00a0\u202f]/g, ' ')

const habit = (
  id: number,
  name: string,
  created: LocalDate = WINDOW[0],
  archivePeriods: ArchivePeriod[] = []
): Habit => ({
  id,
  name,
  icon: 'exercise',
  created,
  archived: archivePeriods.some(p => p.end === null),
  archivePeriods
})

const done = (
  habitId: number,
  dates: readonly LocalDate[]
): HabitEntry[] => dates.map(date => ({ habitId, date }))

const run = (
  habitId: number,
  end: LocalDate,
  days: number
): HabitEntry[] =>
  eachDay({ from: shiftDay(end, 1 - days), to: end })
    .map(date => ({ habitId, date }))

const moodsOn = (
  dates: readonly LocalDate[],
  ...groups: readonly [number, MoodKey][]
): MoodEntry[] => groups
  .flatMap(([n, mood]) => Array.from({ length: n }, () => mood))
  .map((mood, i) => ({ date: dates[i], mood }))

let nextId = 1

/** Nights on each day's following morning (`D + 1`), lasting `minutes`. */
const nightsAfter = (
  days: readonly LocalDate[],
  minutes: number
): SleepPeriod[] => days.map(day => {
  const start = parseISO(day).getTime() + 23 * HOUR
  return { id: nextId++, start, end: start + minutes * MINUTE }
})

const tx = (date: LocalDate, amount: number): Transaction => ({
  id: nextId++, date, description: 'Item', categoryId: 1, amount
})

beforeEach(() => setLocaleOverride('en-US'))
afterEach(() => setLocaleOverride(null))

describe('sleepEffect', () => {
  const yes = WINDOW.slice(10, 17)
  const no = WINDOW.slice(20, 27)
  const exercise = habit(1, 'Exercise')

  it('shows "+41 min" good for 7h41 vs 7h00, "−20 min" bad when lower', () => {
    const good = sleepEffect(
      [exercise],
      done(1, yes),
      [...nightsAfter(yes, 7 * 60 + 41), ...nightsAfter(no, 7 * 60)],
      DATE
    )
    expect(good).toEqual({
      habit: exercise, value: '+41 min', tone: 'good', effect: 41, minutes: 41
    })

    const bad = sleepEffect(
      [exercise],
      done(1, yes),
      [...nightsAfter(yes, 6 * 60 + 40), ...nightsAfter(no, 7 * 60)],
      DATE
    )
    expect(bad).toMatchObject({ value: '−20 min', tone: 'bad', effect: 20 })
  })

  it('gives the Selected Date no next-day Night inside the window', () => {
    const sixPlusToday = [...WINDOW.slice(10, 16), DATE]
    const periods = [
      ...nightsAfter(sixPlusToday, 8 * 60),
      ...nightsAfter(no, 7 * 60)
    ]
    expect(sleepEffect([exercise], done(1, sixPlusToday), periods, DATE))
      .toBeNull()
  })

  it('excludes uncounted days, 0-min effects, and picks largest / oldest', () => {
    const archived = habit(1, 'Archived', WINDOW[10], [
      { start: WINDOW[17], end: WINDOW[19] },
      { start: WINDOW[30], end: null }
    ])
    const periods = [
      ...nightsAfter(WINDOW.slice(0, 10), 10 * 60),
      ...nightsAfter(WINDOW.slice(17, 20), 4 * 60),
      ...nightsAfter(yes, 7 * 60 + 30),
      ...nightsAfter(no, 7 * 60)
    ]
    expect(sleepEffect(
      [archived],
      done(1, [...WINDOW.slice(0, 10), ...yes, ...WINDOW.slice(17, 20)]),
      periods,
      DATE
    )?.value).toBe('+30 min')

    expect(sleepEffect(
      [exercise],
      done(1, yes),
      [...nightsAfter(yes, 7 * 60 + 0.3), ...nightsAfter(no, 7 * 60)],
      DATE
    )).toBeNull()

    const older = habit(2, 'Older', WINDOW[1])
    const newer = habit(3, 'Newer', WINDOW[2])
    const bigger = habit(4, 'Bigger', WINDOW[3])
    expect(sleepEffect(
      [newer, older],
      [...done(2, yes), ...done(3, yes)],
      [...nightsAfter(yes, 7 * 60 + 20), ...nightsAfter(no, 7 * 60)],
      DATE
    )?.habit).toBe(older)

    const rest = WINDOW.slice(30, 37)
    expect(sleepEffect(
      [older, bigger],
      [...done(2, yes), ...done(4, no)],
      [
        ...nightsAfter(yes, 7 * 60 + 10),
        ...nightsAfter(no, 8 * 60),
        ...nightsAfter(rest, 7 * 60)
      ],
      DATE
    )?.habit).toBe(bigger)

    expect(formatSleepEffect(1_200)).toBe('+1,200 min')
    setLocaleOverride('pt-BR')
    expect(formatSleepEffect(1_200)).toBe('+1.200 min')
  })
})

describe('moodEffect', () => {
  const yes = WINDOW.slice(10, 30)
  const no = WINDOW.slice(30, 50)
  const meditation = habit(1, 'Meditation')

  it('shows "2× happy" good and "1.5× neutral" neutral across Locales', () => {
    const happy = moodEffect(
      [meditation],
      done(1, yes),
      [
        ...moodsOn(yes, [8, 'happy'], [12, 'okay']),
        ...moodsOn(no, [4, 'happy'], [16, 'okay'])
      ],
      DATE
    )
    expect(happy).toMatchObject({
      habit: meditation, value: '2× happy', tone: 'good', effect: 2
    })

    const neutralMoods = [
      ...moodsOn(yes, [6, 'neutral'], [14, 'okay']),
      ...moodsOn(no, [4, 'neutral'], [16, 'okay'])
    ]
    const neutral = moodEffect([meditation], done(1, yes), neutralMoods, DATE)
    expect(neutral?.value).toBe('1.5× neutral')
    expect(neutral?.tone).toBe('neutral')

    setLocaleOverride('pt-BR')
    expect(moodEffect([meditation], done(1, yes), neutralMoods, DATE)?.value)
      .toBe('1,5× neutral')
  })

  it('handles drops below 1, bad tones, and inverse ties by age', () => {
    const older = habit(1, 'Older', WINDOW[0])
    const newer = habit(2, 'Newer', WINDOW[5])
    const moods = [
      ...moodsOn(yes, [4, 'stressed'], [16, 'okay']),
      ...moodsOn(no, [8, 'stressed'], [12, 'okay'])
    ]
    const row = moodEffect(
      [newer, older],
      [...done(1, yes), ...done(2, no)],
      moods,
      DATE
    )
    expect(row?.habit).toBe(older)
    expect(row?.value).toBe('0.5× stressed')
    expect(row?.tone).toBe('good')

    const bad = moodEffect([newer], done(2, no), moods, DATE)
    expect(bad?.value).toBe('2× stressed')
    expect(bad?.tone).toBe('bad')
  })

  it('skips under 7 per side, uncounted days, and "1×" effects', () => {
    const shortMoods = [
      ...moodsOn(yes.slice(0, 6), [3, 'happy'], [3, 'okay']),
      ...moodsOn(no.slice(0, 10), [2, 'happy'], [8, 'okay'])
    ]
    expect(moodEffect([meditation], done(1, yes), shortMoods, DATE)).toBeNull()

    // Ratio 1.04 rounds to "1×" -> excluded.
    const flatMoods = [
      ...moodsOn(WINDOW.slice(0, 25), [13, 'happy'], [12, 'okay']),
      ...moodsOn(WINDOW.slice(25, 51), [13, 'happy'], [13, 'okay'])
    ]
    expect(moodEffect(
      [meditation], done(1, WINDOW.slice(0, 25)), flatMoods, DATE
    )).toBeNull()

    const h = habit(1, 'Meditation', WINDOW[20], [
      { start: WINDOW[30], end: WINDOW[45] }
    ])
    const gated = [
      ...moodsOn(WINDOW.slice(10, 30), [10, 'happy'], [10, 'okay']),
      ...moodsOn(WINDOW.slice(30, 50), [10, 'happy'], [10, 'okay'])
    ]
    expect(moodEffect([h], done(1, WINDOW.slice(20, 30)), gated, DATE))
      .toBeNull()
  })
})

describe('expensesEffect', () => {
  const yes = WINDOW.slice(0, 10)
  const no = WINDOW.slice(10, 20)
  const archiveRest: ArchivePeriod[] = [{ start: WINDOW[20], end: null }]
  const scoped = habit(1, 'No-smoking', WINDOW[0], archiveRest)

  it('shows R$ 30 saved (and more) with cents in en-US and pt-BR', () => {
    const txs = [
      ...yes.map(d => tx(d, -7_000)),
      ...no.flatMap(d => [tx(d, -6_000), tx(d, -4_000)]),
      tx(yes[0], 50_000),
      tx(no[0], 0)
    ]
    expect(expensesEffect([scoped], done(1, yes), txs, DATE)).toEqual({
      habit: scoped,
      value: 'R$30.00 saved',
      tone: 'good',
      effect: 3_000,
      savedCentavos: 3_000
    })

    setLocaleOverride('pt-BR')
    expect(plain(expensesEffect([scoped], done(1, yes), txs, DATE)?.value ?? ''))
      .toBe('R$ 30,00 saved')

    setLocaleOverride('en-US')
    const more = expensesEffect(
      [scoped],
      done(1, yes),
      [...yes.map(d => tx(d, -10_000)), ...no.map(d => tx(d, -7_000))],
      DATE
    )
    expect(more).toMatchObject({ value: 'R$30.00 more', tone: 'bad' })
  })

  it('skips under 7 days, zero diff, and breaks ties by age', () => {
    expect(expensesEffect(
      [scoped], done(1, yes.slice(0, 6)), [tx(no[0], -10_000)], DATE
    )).toBeNull()
    expect(expensesEffect(
      [scoped],
      done(1, yes),
      [...yes.map(d => tx(d, -5_000)), ...no.map(d => tx(d, -5_000))],
      DATE
    )).toBeNull()

    const older = habit(1, 'Older', WINDOW[0], archiveRest)
    const newer = habit(2, 'Newer', WINDOW[0], archiveRest)
    expect(expensesEffect(
      [newer, older],
      [...done(1, yes), ...done(2, yes)],
      no.map(d => tx(d, -5_000)),
      DATE
    )?.habit).toBe(older)
  })
})

describe('calendarEffect', () => {
  const reading = habit(1, 'Reading', shiftDay(WINDOW[0], -15))
  const weekdays = (weekday: number): LocalDate[] =>
    WINDOW.filter(d => getDay(parseISO(d)) === weekday)

  it('shows "Fridays" bad for 3 of 5 ended Streaks, English in pt-BR', () => {
    const fridays = weekdays(5)
    const mondays = weekdays(1)
    const entries = [
      ...run(1, fridays[1], 3),
      ...run(1, fridays[3], 4),
      ...run(1, fridays[5], 3),
      ...run(1, mondays[7], 3),
      ...run(1, mondays[9], 5)
    ]
    expect(calendarEffect([reading], entries, DATE)).toEqual({
      habit: reading,
      value: 'Fridays',
      tone: 'bad',
      effect: 3 / 5,
      weekday: 5,
      count: 3,
      total: 5
    })
    setLocaleOverride('pt-BR')
    expect(calendarEffect([reading], entries, DATE)?.value).toBe('Fridays')
  })

  it('counts pre-window starts, skips pre-window ends & open Streaks', () => {
    const fridays = weekdays(5)
    const entries = [
      ...run(1, shiftDay(WINDOW[0], -5), 3),
      ...run(1, WINDOW[0], 3),
      ...run(1, fridays[2], 3),
      ...run(1, fridays[4], 3),
      ...run(1, DATE, 5),
      ...run(1, fridays[6], 2)
    ]
    expect(calendarEffect([reading], entries, DATE))
      .toMatchObject({ value: 'Fridays', count: 2, total: 3 })
  })

  it('needs 3+ ended Streaks, breaks weekday ties by Locale, Habit by age', () => {
    const sundays = weekdays(0)
    const mondays = weekdays(1)
    expect(calendarEffect(
      [reading],
      [...run(1, sundays[1], 3), ...run(1, mondays[3], 3)],
      DATE
    )).toBeNull()

    const tied = [
      ...run(1, sundays[1], 3),
      ...run(1, sundays[3], 3),
      ...run(1, mondays[5], 3),
      ...run(1, mondays[7], 3)
    ]
    expect(calendarEffect([reading], tied, DATE)?.value).toBe('Sundays')
    setLocaleOverride('en-GB')
    expect(calendarEffect([reading], tied, DATE)?.value).toBe('Mondays')

    const older = habit(1, 'Older', WINDOW[0])
    const newer = habit(2, 'Newer', WINDOW[1])
    const fridays = weekdays(5)
    const entries = [1, 2].flatMap(id => [
      ...run(id, fridays[1], 3),
      ...run(id, fridays[3], 3),
      ...run(id, fridays[5], 3)
    ])
    expect(calendarEffect([newer, older], entries, DATE)?.habit).toBe(older)
  })
})
