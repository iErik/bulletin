import { describe, expect, it } from 'vitest'
import type { Occurrence } from '@shared/recurring-tasks'
import type { LocalDate } from '@shared/storage'
import type { LocalTime, Task } from '@shared/tasks'
import { setLocaleOverride } from '@/locale/format'
import { useFixedToday } from '@/testing/clock'
import {
  busiestWeekAhead,
  completion,
  eveningSlip,
  formatEveningSlip,
  formatProductiveAvg,
  formatTaskCount,
  formatWeekRange,
  insightsRange,
  mostProductiveDay,
  rescheduledCount,
  type EveningSlip,
  type InsightTask
} from './insights'

const at = (day: LocalDate, hour = 12, minute = 0): number => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, hour, minute).getTime()
}

const task = (o: Partial<InsightTask> = {}): InsightTask =>
  ({ day: '2026-11-15', time: null, doneAt: null, moves: 0, ...o })

const fullTask = (
  day: LocalDate | null,
  doneAt: number | null = null,
  moves = 0
): Task => ({
  id: 1, title: 'One-off', day, time: '10:00', doneAt,
  created: at('2026-11-01', 9), moves, reminder: null
})

const occurrence = (
  day: LocalDate,
  doneAt: number | null = null,
  time: LocalTime | null = null,
  moves = 0
): Occurrence => ({
  ruleId: 1, scheduled: day, title: 'Recurring', day, time,
  doneAt, moves, created: at('2026-10-01', 9),
  reminder: null
})

const many = (
  count: number,
  build: (i: number) => InsightTask
): InsightTask[] => Array.from({ length: count }, (_, i) => build(i))

describe('insightsRange', () => {
  it('spans 90 days back through 4 Locale weeks ahead', () => {
    // 2026-11-25 is Wed (Sun-start: Nov 22–28, Mon: Nov 23–29).
    expect(insightsRange('2026-11-25', 0))
      .toEqual({ from: '2026-08-28', to: '2026-12-26' })
    expect(insightsRange('2026-11-25', 1))
      .toEqual({ from: '2026-08-28', to: '2026-12-27' })
  })
})

describe('completion', () => {
  it('shows 78% and on time 64% for 50 planned, 39 done, 32 on time', () => {
    const items: InsightTask[] = [
      ...many(30, () => task({
        day: '2026-11-10', doneAt: at('2026-11-10', 18)
      })),
      ...many(2, () => task({
        day: '2026-11-10', doneAt: at('2026-11-09', 18)
      })),
      ...many(7, () => task({
        day: '2026-11-10', doneAt: at('2026-11-11', 9)
      })),
      ...many(11, () => task({ day: '2026-11-12' }))
    ]

    expect(completion(items, '2026-11-20')).toEqual({
      planned: 50, done: 39, onTime: 32, percent: 78, onTimePercent: 64
    })
  })

  it('counts missed Occurrences as undone and ignores out-of-span', () => {
    const items: InsightTask[] = [
      fullTask('2026-11-01', at('2026-11-01', 23, 59)),
      occurrence('2026-11-05', null),
      fullTask('2026-10-31', at('2026-10-31')),
      fullTask('2026-11-21', at('2026-11-21')),
      fullTask(null, at('2026-11-05'))
    ]

    expect(completion(items, '2026-11-20')).toEqual({
      planned: 2, done: 1, onTime: 1, percent: 50, onTimePercent: 50
    })
  })

  it('counts a Task finished after Selected Date as done but late', () => {
    const items = [task({ day: '2026-10-30', doneAt: at('2026-11-02') })]

    expect(completion(items, '2026-10-31')).toEqual({
      planned: 1, done: 1, onTime: 0, percent: 100, onTimePercent: 0
    })
  })

  it('is hidden when nothing is planned in the month so far', () => {
    expect(completion([], '2026-11-20')).toBeNull()
    expect(completion([
      task({ day: null }),
      task({ day: '2026-10-31' }),
      task({ day: '2026-11-21' })
    ], '2026-11-20')).toBeNull()
  })
})

describe('mostProductiveDay', () => {
  // 2026-11-25 is Wed. 84-day window: 2026-09-03..2026-11-25.
  const DATE: LocalDate = '2026-11-25'

  it('picks the weekday with the highest average done per day', () => {
    const items: InsightTask[] = [
      // 62 done on Tuesdays (incl. Someday & Occurrence).
      ...many(60, () => task({
        day: '2026-11-20', doneAt: at('2026-11-24')
      })),
      task({ day: null, doneAt: at('2026-11-17') }),
      occurrence('2026-11-10', at('2026-11-10')),
      ...many(30, () => task({
        day: '2026-11-25', doneAt: at('2026-11-25')
      })),
      ...many(100, () => task({ doneAt: at('2026-09-02') })),
      ...many(100, () => task({ doneAt: at('2026-11-26') })),
      ...many(100, () => task({ day: '2026-11-25' }))
    ]

    expect(mostProductiveDay(items, DATE, 0))
      .toEqual({ weekday: 2, done: 62, average: 62 / 12 })
  })

  it('includes the first day of the 84-day window', () => {
    // 2026-09-03 is Thu (4).
    const items = [task({ doneAt: at('2026-09-03') })]
    expect(mostProductiveDay(items, DATE, 0))
      .toEqual({ weekday: 4, done: 1, average: 1 / 12 })
  })

  it('breaks ties by earlier weekday in the Locale week', () => {
    // 2026-11-22 is Sun (0), 2026-11-23 is Mon (1).
    const items = [
      task({ doneAt: at('2026-11-22') }),
      task({ doneAt: at('2026-11-23') })
    ]
    expect(mostProductiveDay(items, DATE, 0)?.weekday).toBe(0)
    expect(mostProductiveDay(items, DATE, 1)?.weekday).toBe(1)
  })

  it('is hidden when no Tasks were done in the 12 weeks', () => {
    expect(mostProductiveDay([], DATE, 0)).toBeNull()
    expect(mostProductiveDay([
      task({ doneAt: null }),
      task({ doneAt: at('2026-09-02') }),
      task({ doneAt: at('2026-11-26') })
    ], DATE, 0)).toBeNull()
  })
})

describe('eveningSlip', () => {
  const DATE: LocalDate = '2026-11-25'

  const timed = (
    time: LocalTime,
    slipped: boolean,
    day: LocalDate = '2026-11-10'
  ): InsightTask => task({
    day, time, doneAt: slipped ? null : at(day, 18)
  })

  it('computes 2× more for 40% evening vs 20% other slips', () => {
    const items = [
      ...many(4, () => timed('20:30', true)),
      ...many(6, () => timed('21:00', false)),
      ...many(2, () => timed('10:00', true)),
      ...many(8, () => timed('14:00', false))
    ]

    expect(eveningSlip(items, DATE)).toEqual({
      ratio: 2, more: true, eveningSlipped: 4, eveningTotal: 10,
      otherSlipped: 2, otherTotal: 10
    })
  })

  it('handles ratio < 1, early/late done, and 20:00 boundary', () => {
    const items: InsightTask[] = [
      // Evening (>20:00): 2 slipped (1 undone, 1 late), 8 on time.
      timed('20:01', true),
      task({ day: '2026-11-10', time: '20:01', doneAt: at('2026-11-11') }),
      task({ day: '2026-11-10', time: '20:01', doneAt: at('2026-11-09') }),
      ...many(7, () => timed('21:30', false)),
      // Other (20:00 counts as other): 4 slipped, 6 on time.
      ...many(4, () => timed('20:00', true)),
      ...many(6, () => timed('20:00', false)),
      ...many(10, () => task({ day: '2026-11-10', time: null })),
      ...many(10, () => task({ day: null, time: '22:00' })),
      ...many(10, () => timed('22:00', true, '2026-08-27')),
      ...many(10, () => timed('22:00', true, '2026-11-26'))
    ]

    expect(eveningSlip(items, DATE)).toMatchObject({
      ratio: 0.5, more: false, eveningSlipped: 2, eveningTotal: 10,
      otherSlipped: 4, otherTotal: 10
    })
  })

  it('hides with < 7 on either side, 0 slips, or ~1× ratio', () => {
    expect(eveningSlip([
      ...many(6, () => timed('21:00', true)),
      ...many(7, () => timed('10:00', true))
    ], DATE)).toBeNull()
    expect(eveningSlip([
      ...many(7, () => timed('21:00', true)),
      ...many(6, () => timed('10:00', true))
    ], DATE)).toBeNull()
    expect(eveningSlip([
      ...many(7, () => timed('21:00', false)),
      ...many(7, () => timed('10:00', true))
    ], DATE)).toBeNull()
    expect(eveningSlip([
      ...many(7, () => timed('21:00', true)),
      ...many(7, () => timed('10:00', false))
    ], DATE)).toBeNull()
    // Ratio 26/25 = 1.04 rounds to 1.0 -> hidden.
    expect(eveningSlip([
      ...many(26, () => timed('21:00', true)),
      ...many(74, () => timed('21:00', false)),
      ...many(25, () => timed('10:00', true)),
      ...many(75, () => timed('10:00', false))
    ], DATE)).toBeNull()
  })
})

describe('rescheduledCount', () => {
  it('counts open Tasks with 3+ moves and skips done ones', () => {
    const items: InsightTask[] = [
      task({ moves: 2 }),
      task({ moves: 3 }),
      fullTask(null, null, 4),
      occurrence('2026-11-20', null, null, 5),
      task({ moves: 6, doneAt: at('2026-11-15') })
    ]
    expect(rescheduledCount(items)).toBe(3)
  })

  it('is hidden when no open Task has 3+ moves', () => {
    expect(rescheduledCount([])).toBeNull()
    expect(rescheduledCount([
      task({ moves: 2 }),
      task({ moves: 5, doneAt: at('2026-11-15') })
    ])).toBeNull()
  })
})

describe('busiestWeekAhead', () => {
  // 2025-11-26 is Wed. Mon-start week: Nov 24–30.
  const DATE: LocalDate = '2025-11-26'

  it('picks the busiest of the next 4 Locale weeks', () => {
    const items: InsightTask[] = [
      ...many(20, () => task({ day: '2025-11-28' })),
      ...many(20, () => task({ day: '2025-12-29' })),
      ...many(20, () => task({ day: null })),
      ...many(10, () => task({ day: '2025-12-01' })),
      ...many(4, () => occurrence('2025-12-07')),
      ...many(5, () => task({ day: '2025-12-10' }))
    ]
    expect(busiestWeekAhead(items, DATE, 1))
      .toEqual({ from: '2025-12-01', to: '2025-12-07', count: 14 })
  })

  it('respects Locale weekStartsOn and picks earliest on tie', () => {
    const items = [
      task({ day: '2025-11-30' }),
      task({ day: '2025-12-07' })
    ]
    expect(busiestWeekAhead(items, DATE, 0))
      .toEqual({ from: '2025-11-30', to: '2025-12-06', count: 1 })
    expect(busiestWeekAhead(items, DATE, 1))
      .toEqual({ from: '2025-12-01', to: '2025-12-07', count: 1 })
  })

  it('is hidden when all 4 weeks ahead are empty', () => {
    expect(busiestWeekAhead([], DATE, 1)).toBeNull()
    expect(busiestWeekAhead([
      task({ day: '2025-11-30' }),
      task({ day: '2025-12-29' })
    ], DATE, 1)).toBeNull()
  })
})

describe('formatters', () => {
  useFixedToday()

  it('formats productive average to one Locale decimal', () => {
    expect(formatProductiveAvg(5.23)).toBe('avg 5.2 done')
    expect(formatProductiveAvg(5)).toBe('avg 5.0 done')
    setLocaleOverride('pt-BR')
    expect(formatProductiveAvg(5.2)).toBe('avg 5,2 done')
  })

  it('formats evening slip ratios dropping trailing .0', () => {
    const slip = (ratio: number): EveningSlip => ({
      ratio, more: ratio >= 1, eveningSlipped: 1,
      eveningTotal: 7, otherSlipped: 1, otherTotal: 7
    })
    expect(formatEveningSlip(slip(2))).toBe('2× more')
    expect(formatEveningSlip(slip(2.34))).toBe('2.3× more')
    expect(formatEveningSlip(slip(0.5))).toBe('2× less')
    expect(formatEveningSlip(slip(2 / 3))).toBe('1.5× less')
    setLocaleOverride('pt-BR')
    expect(formatEveningSlip(slip(2.3))).toBe('2,3× more')
  })

  it('formats singular and plural task counts', () => {
    expect(formatTaskCount(1)).toBe('1 task')
    expect(formatTaskCount(3)).toBe('3 tasks')
    expect(formatTaskCount(14)).toBe('14 tasks')
  })

  it('formats week ranges in the Locale', () => {
    expect(formatWeekRange({ from: '2025-12-01', to: '2025-12-07' }))
      .toBe('Dec 1–7')
    expect(formatWeekRange({ from: '2026-11-29', to: '2026-12-05' }))
      .toBe('Nov 29–Dec 5')
  })
})
