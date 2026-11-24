import { afterEach, describe, expect, it } from 'vitest'
import {
  enableAutoUnmount,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { h } from 'vue'
import type { Budget, Transaction } from '@shared/expenses'
import { monthPace } from '@/expenses/month-pace'
import { formatAmount } from '@/expenses/money'
import { formatDate } from '@/locale/format'
import { useFixedToday } from '@/testing/clock'
import MonthPaceChart from './MonthPaceChart.vue'

// Plot spans x 66..700 (634px) and y 18..326 (308px) at
// the 720×340 default size.
const LEFT = 66
const RIGHT = 700
const TOP = 18
const BOTTOM = 326

let nextId = 1

const tx = (
  date: string,
  amount: number,
  description = 'Item'
): Transaction => ({
  id: nextId++,
  date,
  description,
  categoryId: 1,
  amount
})

const budget = (amount: number): Budget =>
  ({ month: '2026-11', amount })

const nov = (day: number): Date => new Date(2026, 10, day)

const SAMPLE_TXS: Transaction[] = [
  tx('2026-11-05', -379_500, 'Groceries'),
  tx('2026-11-12', -1_299_300, 'MPB M5')
]

const mountChart = (options: {
  transactions?: readonly Transaction[]
  budget?: Budget | null
  day?: number
  isToday?: boolean
} = {}): VueWrapper => {
  const {
    transactions = SAMPLE_TXS,
    budget: limit = budget(2_400_000),
    day = 21,
    isToday = true
  } = options
  const selectedDate = nov(day)
  return mount(MonthPaceChart, {
    props: {
      pace: monthPace(transactions, limit, selectedDate),
      selectedDate,
      isToday
    },
    attachTo: document.body
  })
}

describe('MonthPaceChart', () => {
  useFixedToday()
  enableAutoUnmount(afterEach)

  it('draws grid lines and y-axis labels', () => {
    const chart = mountChart()
    const grids = chart.findAll('.grid')
    const ticks = chart.findAll('.tick')

    expect(grids).toHaveLength(5)
    expect(ticks.map(t => t.text()))
      .toEqual(['0', '6k', '12k', '18k', '24k'])
    expect(ticks.map(t => Number(t.attributes('y'))))
      .toEqual([BOTTOM, 249, 172, 95, TOP])
    expect(grids[0].attributes('x1')).toBe(String(LEFT))
    expect(grids[0].attributes('x2')).toBe(String(RIGHT))
  })

  it('draws spent line, area, budget, projection and tip', () => {
    const chart = mountChart()
    const pace = monthPace(SAMPLE_TXS, budget(2_400_000), nov(21))

    // Spent line uses straight segments (L), never curves.
    const lineD = chart.get('.spent-line').attributes('d')!
    expect(lineD).toMatch(/^M66,/)
    expect(lineD).not.toMatch(/[CcSsQqTt]/)
    expect(chart.get('.spent-area').attributes('d')).toBeTruthy()
    expect(chart.get('.spent-area').attributes('fill'))
      .toMatch(/^url\(#/)
    expect(chart.get('.spent-line').attributes('filter'))
      .toMatch(/^url\(#/)

    // Budget pace line from (day 1, 0) to (day 30, budget).
    const budgetLine = chart.get('.budget-line')
    expect(Number(budgetLine.attributes('x1'))).toBe(LEFT)
    expect(Number(budgetLine.attributes('y1'))).toBe(BOTTOM)
    expect(Number(budgetLine.attributes('x2'))).toBe(RIGHT)
    expect(Number(budgetLine.attributes('y2'))).toBe(TOP)
    expect(chart.get('.budget-label').text()).toBe('Budget')

    // Projection dotted line and formatted label with cents.
    const projLine = chart.get('.projection-line')
    const day21X = LEFT + (20 / 29) * (RIGHT - LEFT)
    expect(Number(projLine.attributes('x1'))).toBeCloseTo(day21X)
    expect(Number(projLine.attributes('x2'))).toBe(RIGHT)
    expect(chart.get('.projection-label').text())
      .toBe(formatAmount(Math.round(pace.projection)))

    // Selected Date marker, dot and "Today · ..." tooltip.
    const marker = chart.get('.marker')
    expect(Number(marker.attributes('x1'))).toBeCloseTo(day21X)
    expect(Number(marker.attributes('y1'))).toBe(TOP)
    expect(Number(marker.attributes('y2'))).toBe(BOTTOM)

    const dot = chart.get('.dot')
    expect(Number(dot.attributes('cx'))).toBeCloseTo(day21X)
    expect(dot.attributes('r')).toBe('4')

    const tip = chart.get('.tooltip')
    expect(tip.text()).toBe(`Today · ${formatAmount(pace.spent)}`)
    expect(tip.classes()).not.toContain('-flipped')
  })

  it('uses short date in tooltip when not today', () => {
    const chart = mountChart({ day: 12, isToday: false })
    const pace = monthPace(SAMPLE_TXS, budget(2_400_000), nov(12))
    const short = formatDate(nov(12), 'short')

    expect(chart.get('.tooltip').text())
      .toBe(`${short} · ${formatAmount(pace.spent)}`)
  })

  it('hides projection line and label on month last day', () => {
    const chart = mountChart({ day: 30, isToday: false })

    expect(chart.find('.projection-line').exists()).toBe(false)
    expect(chart.find('.projection-label').exists()).toBe(false)
    expect(chart.get('svg').attributes('aria-label'))
      .not.toContain('projected')
  })

  it('hides budget line and label when budget is null', () => {
    const chart = mountChart({ budget: null })

    expect(chart.find('.budget-line').exists()).toBe(false)
    expect(chart.find('.budget-label').exists()).toBe(false)
    expect(chart.get('svg').attributes('aria-label'))
      .not.toContain('budget')
  })

  it('draws a flat zero line with no expenses', () => {
    const chart = mountChart({
      transactions: [],
      budget: budget(2_400_000),
      day: 15
    })

    const lineD = chart.get('.spent-line').attributes('d')!
    const ys = [...lineD.matchAll(/,([\d.]+)/g)]
      .map(m => Number(m[1]))
    expect(ys.length).toBe(15)
    expect(ys.every(y => y === BOTTOM)).toBe(true)
    expect(chart.find('.budget-line').exists()).toBe(true)
  })

  it('groups multiple large expenses on the same day', () => {
    const chart = mountChart({
      transactions: [
        tx('2026-11-12', -700_000, 'Sofa'),
        tx('2026-11-12', -1_299_300, 'MPB M5'),
        tx('2026-11-12', -650_000, 'Desk'),
        tx('2026-11-18', -800_000, 'Flight')
      ],
      budget: budget(2_400_000),
      day: 21
    })

    const labels = chart.findAll('.large-label')
    expect(labels.map(el => el.text()))
      .toEqual(['MPB M5 +2', 'Flight'])
  })

  it('flips tooltip right near day 1 to stay inside plot', () => {
    const chart = mountChart({ day: 1, isToday: true })

    expect(chart.get('.tooltip').classes()).toContain('-flipped')
    expect(Number(chart.get('.dot').attributes('cx'))).toBe(LEFT)
  })

  it('summarizes spent, projection and budget in aria-label', () => {
    const chart = mountChart()
    const pace = monthPace(SAMPLE_TXS, budget(2_400_000), nov(21))
    const label = chart.get('svg').attributes('aria-label')

    expect(label).toContain(formatAmount(pace.spent))
    expect(label).toContain(
      formatAmount(Math.round(pace.projection))
    )
    expect(label).toContain(formatAmount(2_400_000))
  })

  it('gives each mounted chart unique SVG def ids', () => {
    const selectedDate = nov(21)
    const props = {
      pace: monthPace(SAMPLE_TXS, budget(2_400_000), selectedDate),
      selectedDate,
      isToday: true
    }
    const page = mount(
      () => [h(MonthPaceChart, props), h(MonthPaceChart, props)],
      { attachTo: document.body }
    )

    const fills = page.findAll('.spent-area')
      .map(el => el.attributes('fill'))
    const filters = page.findAll('.spent-line')
      .map(el => el.attributes('filter'))
    expect(fills[0]).not.toBe(fills[1])
    expect(filters[0]).not.toBe(filters[1])
  })
})
