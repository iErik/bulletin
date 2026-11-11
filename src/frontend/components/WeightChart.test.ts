import { afterEach, describe, expect, it } from 'vitest'
import {
  enableAutoUnmount,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import type { WeightEntry } from '@shared/weight'
import { useFixedToday } from '@/testing/clock'
import WeightChart from './WeightChart.vue'

const ENTRIES: WeightEntry[] = [
  { date: '2026-03-02', grams: 70_000 },
  { date: '2026-07-02', grams: 63_400 },
  { date: '2026-09-10', grams: 65_000 }
]

const mountChart = (
  props: Partial<{
    day: Date
    entries: WeightEntry[]
    failed: boolean
  }> = {}
): VueWrapper => mount(WeightChart, {
  props: {
    day: new Date(2026, 6, 14),
    entries: ENTRIES,
    ...props
  },
  attachTo: document.body
})

const texts = (
  chart: VueWrapper,
  selector: string
): string[] =>
  chart.findAll(selector).map(el => el.text())

describe('WeightChart', () => {
  useFixedToday()
  enableAutoUnmount(afterEach)

  it('names the chart and its range', () => {
    expect(mountChart().get('svg').attributes('aria-label'))
      .toBe('Weight chart, February 2026 to December 2026')
  })

  it('labels every other month of the 11', () => {
    const chart = mountChart()

    expect(chart.findAll('.month')).toHaveLength(11)
    expect(texts(chart, '.month').filter(Boolean))
      .toEqual(['Feb', 'Apr', 'Jun', 'Aug', 'Oct', 'Dec'])
  })

  it('labels the y axis every 10 kg', () => {
    expect(texts(mountChart(), '.tick'))
      .toEqual(['60 kg', '70 kg', '80 kg'])
  })

  describe('the glow', () => {
    it('sits on the Selected Date\'s Entry', () => {
      const glow = mountChart({ day: new Date(2026, 6, 2) })
        .get('.glow')

      // 63.4 kg on a 60 to 80 kg axis from y 128 to 8
      expect(Number(glow.attributes('cy')))
        .toBeCloseTo(107.6)
    })

    it('is interpolated between Entries', () => {
      const glow = mountChart().get('.glow')
      const cy = Number(glow.attributes('cy'))

      // Between 63.4 kg (y 107.6) and 65 kg (y 98)
      expect(cy).toBeLessThan(107.6)
      expect(cy).toBeGreaterThan(98)
    })

    it('is absent after the last Entry', () => {
      const chart = mountChart({ day: new Date(2026, 10, 9) })

      expect(chart.find('.glow').exists()).toBe(false)
    })
  })

  describe('a lone Entry', () => {
    const LONE = [{ date: '2026-07-02', grams: 63_400 }]

    it('is drawn as a dot', () => {
      const chart = mountChart({ entries: LONE })

      expect(chart.find('.notice').exists()).toBe(false)
      // 63.4 kg on a 50 to 70 kg axis from y 128 to 8
      expect(Number(chart.get('.dot').attributes('cy')))
        .toBeCloseTo(47.6)
    })

    it('glows unclipped on its own day', () => {
      const glow = mountChart({
        entries: LONE,
        day: new Date(2026, 6, 2)
      }).get('.glow')

      expect(Number(glow.attributes('cy')))
        .toBeCloseTo(47.6)
      expect(glow.attributes('clip-path')).toBeUndefined()
    })

    it('outside the window shows the empty state', () => {
      const chart = mountChart({
        entries: [{ date: '2024-01-02', grams: 63_400 }]
      })

      expect(chart.get('.notice').text())
        .toBe('No weight logged yet')
      expect(chart.find('.dot').exists()).toBe(false)
    })
  })

  it('has no dot with a curve', () => {
    expect(mountChart().find('.dot').exists()).toBe(false)
  })

  it('shows the empty state with no Entries', () => {
    const chart = mountChart({ entries: [] })

    expect(chart.get('.notice').text())
      .toBe('No weight logged yet')
    expect(texts(chart, '.tick')).toEqual(
      ['40 kg', '50 kg', '60 kg', '70 kg', '80 kg']
    )
    expect(chart.findAll('.month')).toHaveLength(11)
    expect(chart.find('.glow').exists()).toBe(false)
  })

  it('draws towards Entries outside the window', () => {
    const chart = mountChart({
      entries: [
        { date: '2025-12-20', grams: 70_000 },
        { date: '2027-02-10', grams: 65_000 }
      ]
    })

    // No Entry in the window, but a curve across it,
    // clipped to the plot.
    expect(chart.find('.notice').exists()).toBe(false)
    expect(chart.get('.line').attributes('d'))
      .not.toBe('')
    expect(chart.get('g').attributes('clip-path'))
      .toMatch(/^url\(#/)
  })

  it('says when loading failed', () => {
    const chart = mountChart({ entries: [], failed: true })

    expect(chart.get('[role="alert"]').text())
      .toBe('Couldn\'t load your weight')
  })
})
