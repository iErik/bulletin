import { addDays, parseISO } from 'date-fns'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest'
import { localDate } from '@shared/dates'
import type { Budget, Transaction } from '@shared/expenses'
import type { Habit, HabitEntry } from '@shared/habits'
import type { MoodEntry, MoodKey } from '@shared/mood'
import type { SleepPeriod } from '@shared/sleep'
import type { LocalDate } from '@shared/storage'
import { setLocaleOverride } from '@/locale/format'
import type { MoodEffect } from './mood-effect'
import {
  calendarRow,
  expensesRow,
  formatMoodEffect,
  habitsRow,
  sleepRow
} from './what-moves'

/** A Thursday, so day −89 is a Saturday. */
const DATE = '2026-11-19'

const shift = (day: LocalDate, n: number): LocalDate =>
  localDate(addDays(parseISO(day), n))

/** The window's days, oldest first: −89 … 0. */
const WINDOW = Array.from({ length: 90 }, (_, i) =>
  shift(DATE, i - 89))

const isWeekend = (day: LocalDate): boolean =>
  [0, 6].includes(parseISO(day).getDay())

/** Assigns Moods to `dates` in order, `n` of each. */
const moodsOn = (
  dates: readonly LocalDate[],
  ...groups: readonly [number, MoodKey][]
): MoodEntry[] => {
  const moods = groups.flatMap(([n, mood]) =>
    Array.from({ length: n }, () => mood))
  if (moods.length > dates.length)
    throw new Error('not enough days')
  return moods.map((mood, i) => ({ date: dates[i], mood }))
}

const effect = (
  mood: MoodKey,
  [count, days]: [number, number],
  [fCount, fDays]: [number, number]
): MoodEffect => ({
  mood,
  ratio: (count * fDays) / (fCount * days),
  onTrue: { count, days },
  onFalse: { count: fCount, days: fDays },
  tone: 'neutral'
})

beforeEach(() => setLocaleOverride('en-US'))
afterEach(() => setLocaleOverride(null))

describe('formatMoodEffect', () => {
  it('shows an effect under 2× as a signed percentage', () => {
    expect(formatMoodEffect(effect('happy', [59, 100], [50, 100])))
      .toBe('+18% happy')
    expect(formatMoodEffect(effect('anxious', [3, 25], [5, 25])))
      .toBe('−40% anxious')
  })

  it('shows 2× or more as the ratio, dropping ".0"', () => {
    expect(formatMoodEffect(effect('happy', [21, 50], [4, 20])))
      .toBe('2.1× happy')
    expect(formatMoodEffect(effect('stressed', [4, 10], [2, 10])))
      .toBe('2× stressed')
  })

  it('shows a fall of 2× or more as the ratio', () => {
    expect(formatMoodEffect(effect('anxious', [1, 10], [2, 10])))
      .toBe('0.5× anxious')
    expect(formatMoodEffect(effect('anxious', [2, 10], [5, 10])))
      .toBe('0.4× anxious')
  })
})

describe('calendarRow', () => {
  const weekends = WINDOW.filter(isWeekend)
  const weekdays = WINDOW.filter(day => !isWeekend(day))

  it('shows "+18% happy" for 1.18× on weekends', () => {
    const row = calendarRow([
      ...moodsOn(weekends, [1, 'happy'], [9, 'neutral']),
      ...moodsOn(weekdays, [5, 'happy'], [54, 'neutral'])
    ], DATE)
    expect(row?.value).toBe('+18% happy')
    expect(row?.effect.tone).toBe('good')
  })

  it('hides a side with fewer than 7 days', () => {
    const row = calendarRow([
      ...moodsOn(weekends, [3, 'happy'], [3, 'okay']),
      ...moodsOn(weekdays, [2, 'happy'], [8, 'okay'])
    ], DATE)
    expect(row).toBeNull()
  })

  it('uses only the 90 days ending on the Selected Date', () => {
    const base = [
      ...moodsOn(weekends.slice(1), [3, 'happy'], [3, 'okay']),
      ...moodsOn(weekdays, [2, 'happy'], [8, 'okay'])
    ]
    const at = (date: LocalDate): MoodEntry[] =>
      [...base, { date, mood: 'happy' }]
    expect(WINDOW[0]).toBe(weekends[0])
    expect(calendarRow(at(WINDOW[0]), DATE)).not.toBeNull()
    expect(calendarRow(at(shift(WINDOW[0], -7)), DATE)).toBeNull()
    expect(calendarRow(at('2026-11-21'), DATE)).toBeNull()
  })

  it('hides a row whose change rounds to 0%', () => {
    const row = calendarRow([
      ...moodsOn(weekends, [5, 'happy'], [5, 'okay']),
      ...moodsOn(weekdays, [5, 'happy'], [5, 'okay'])
    ], DATE)
    expect(row).toBeNull()
  })
})

describe('sleepRow', () => {
  const HOUR = 60 * 60 * 1000
  let nextId = 1

  /** A Night ending on `day`'s morning. */
  const night = (day: LocalDate, hours: number): SleepPeriod => {
    const start = parseISO(shift(day, -1)).getTime() + 23 * HOUR
    return { id: nextId++, start, end: start + hours * HOUR }
  }

  it('shows "2.1× happy" for 7h Nights against shorter ones', () => {
    const long = WINDOW.slice(10, 60)
    const short = WINDOW.slice(60, 80)
    const noNight = WINDOW.slice(80)
    const row = sleepRow([
      ...moodsOn(long, [21, 'happy'], [29, 'okay']),
      ...moodsOn(short, [4, 'happy'], [16, 'okay']),
      ...moodsOn(noNight, [10, 'angry'])
    ], [
      ...long.map(day => night(day, 7)),
      ...short.map(day => night(day, 6.5))
    ], 7 * 60, DATE)
    expect(row?.value).toBe('2.1× happy')
    expect(row?.effect.tone).toBe('good')
    expect(row?.goalMinutes).toBe(420)
  })
})

describe('habitsRow', () => {
  const habit = (
    id: number,
    name: string,
    created: LocalDate,
    archivePeriods: Habit['archivePeriods'] = []
  ): Habit => ({
    id,
    name,
    icon: 'meditation',
    created,
    archived: archivePeriods.some(p => p.end === null),
    archivePeriods
  })

  const done = (
    habitId: number,
    dates: readonly LocalDate[]
  ): HabitEntry[] => dates.map(date => ({ habitId, date }))

  const before = WINDOW.slice(0, 10)
  const archived = WINDOW.slice(11, 15)
  const yes = WINDOW.slice(15, 40)
  const no = WINDOW.slice(40, 65)
  const meditation = habit(1, 'Meditation', WINDOW[10], [
    { start: archived[0], end: archived[3] }
  ])
  const moods = [
    ...moodsOn(before, [10, 'anxious']),
    ...moodsOn(archived, [4, 'anxious']),
    ...moodsOn(yes, [3, 'anxious'], [22, 'okay']),
    ...moodsOn(no, [5, 'anxious'], [20, 'okay'])
  ]

  it('shows "Meditation · −40% anxious" with a green tone', () => {
    const row = habitsRow(
      moods, [meditation], done(1, yes), DATE
    )
    expect(row?.habit).toBe(meditation)
    expect(row?.value).toBe('−40% anxious')
    expect(row?.effect.tone).toBe('good')
  })

  it('shows the Habit with the strongest effect', () => {
    const reading = habit(2, 'Reading', WINDOW[0])
    const row = habitsRow(
      moods,
      [reading, meditation],
      [...done(1, yes), ...done(2, WINDOW.filter((_, i) => i % 2))],
      DATE
    )
    expect(row?.habit.name).toBe('Meditation')
  })

  it('breaks a tie in favour of the older Habit', () => {
    const twin = habit(2, 'Twin', WINDOW[5])
    const row = habitsRow(
      moods.filter(m => m.date >= yes[0]),
      [meditation, twin],
      [...done(1, yes), ...done(2, yes)],
      DATE
    )
    expect(row?.habit.name).toBe('Twin')
  })
})

describe('expensesRow', () => {
  let nextId = 1
  const tx = (date: LocalDate, amount: number): Transaction => ({
    id: nextId++, date, description: 'Item', categoryId: 1, amount
  })
  const date = '2026-11-20'
  const nov = Array.from({ length: 20 }, (_, i) =>
    `2026-11-${String(i + 1).padStart(2, '0')}`)
  const october = Array.from({ length: 20 }, (_, i) =>
    `2026-10-${String(i + 1).padStart(2, '0')}`)
  const moods = [
    ...moodsOn(nov.slice(0, 10), [2, 'stressed'], [8, 'okay']),
    ...moodsOn(nov.slice(10), [4, 'stressed'], [6, 'okay']),
    ...moodsOn(october, [20, 'stressed'])
  ]
  const budgets = (
    oct: Budget | null
  ): Map<string, Budget | null> => new Map<string, Budget | null>([
    ['2026-10', oct],
    ['2026-11', { month: '2026-11', amount: 30_000 }]
  ])

  it('shows "2× stressed" with a red tone over pace', () => {
    const row = expensesRow(
      moods,
      [tx('2026-11-11', -20_000), tx('2026-11-12', 50_000)],
      budgets(null),
      date
    )
    expect(row?.value).toBe('2× stressed')
    expect(row?.effect.tone).toBe('bad')
  })

  it('leaves out the days of a month without a Budget', () => {
    const row = expensesRow(
      moods,
      [tx('2026-11-11', -20_000)],
      new Map([['2026-11', { month: '2026-11', amount: 30_000 }]]),
      date
    )
    expect(row?.value).toBe('2× stressed')
  })

  it('counts a month with a Budget, spend or not', () => {
    const row = expensesRow(
      moods,
      [tx('2026-11-11', -20_000)],
      budgets({ month: '2026-10', amount: 30_000 }),
      date
    )
    expect(row?.value).not.toBe('2× stressed')
  })
})
