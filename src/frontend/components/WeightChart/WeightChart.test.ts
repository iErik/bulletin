import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import {
  type DOMWrapper,
  enableAutoUnmount,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { h } from 'vue'
import type { WeightEntry } from '@shared/weight'
import { useFixedToday } from '@/testing/clock'
import WeightChart from './WeightChart.vue'

const ENTRIES: WeightEntry[] = [
  { date: '2026-03-02', grams: 70_000 },
  { date: '2026-07-02', grams: 63_400 },
  { date: '2026-09-10', grams: 65_000 }
]

// The plot spans x 38 to 372 and y 25 to 130 at the
// default size, 375 by 150.
const LEFT = 38
const RIGHT = 372
const TOP = 25
const BOTTOM = 130
// Jul 2's centre, day 151.5 of 334
const JUL_2 = 190

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

const tooltip = (
  chart: VueWrapper
): string | undefined => {
  const tip = chart.get('.tooltip')
  return tip.isVisible() ? tip.text() : undefined
}

const press = (
  chart: VueWrapper,
  key: string
): Promise<void> =>
  chart.get('svg').trigger('keydown', { key })

const hover = (
  chart: VueWrapper,
  clientX: number
): Promise<void> =>
  chart.get('svg').trigger('pointermove', { clientX })

// The gradient the line strokes with.
const lineGradient = (
  chart: VueWrapper
): Omit<DOMWrapper<Element>, 'exists'> => {
  const id = chart.get('.line').attributes('stroke')!
    .match(/^url\(#(.+)\)$/)![1]
  return chart.get(`[id="${id}"]`)
}

// Whether keys pressed in the chart reach the window,
// where the date header listens.
const reachesWindow = async (
  chart: VueWrapper,
  key: string
): Promise<boolean> => {
  const listener = vi.fn()
  window.addEventListener('keydown', listener)
  await press(chart, key)
  window.removeEventListener('keydown', listener)
  return listener.mock.calls.length > 0
}

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

  it('starts each month label before its month', () => {
    const xs = mountChart().findAll('.month')
      .map(el => Number(el.attributes('x')))

    // Feb 1 is the plot's left edge, Mar 1 is 28 days on.
    expect(xs[0]).toBe(LEFT - 4)
    expect(xs[1]).toBe(LEFT + 28 - 4)
  })

  it('puts the month labels under the plot', () => {
    expect(mountChart().get('.month').attributes('y'))
      .toBe(String(BOTTOM + 17))
  })

  it('labels the y axis every 10 kg', () => {
    const chart = mountChart()

    expect(texts(chart, '.tick'))
      .toEqual(['60 kg', '70 kg', '80 kg'])
    expect(chart.findAll('.tick').map(
      el => el.attributes('y')
    )).toEqual([String(BOTTOM), '77.5', String(TOP)])
  })

  it('draws grid lines at all but the bottom tick', () => {
    const lines = mountChart().findAll('.grid')

    expect(lines.map(el => el.attributes('y1')))
      .toEqual([String(TOP), '77.5'])
    expect(lines.map(el => el.attributes('y2')))
      .toEqual([String(TOP), '77.5'])
    expect(lines[0].attributes('x1')).toBe(String(LEFT))
    expect(lines[0].attributes('x2'))
      .toBe(String(RIGHT - 14.5))
  })

  describe('hovering', () => {
    it('snaps to the nearest Entry', async () => {
      const chart = mountChart()

      await hover(chart, LEFT)
      expect(tooltip(chart)).toBe('Mar 2, 70.0 kg')
      await hover(chart, JUL_2)
      expect(tooltip(chart)).toBe('Jul 2, 63.4 kg')
      await hover(chart, RIGHT)
      expect(tooltip(chart)).toBe('Sep 10, 65.0 kg')
    })

    it('drops the line from the top to the Entry', async () => {
      const chart = mountChart()

      await hover(chart, JUL_2)
      const cursor = chart.get('.cursor')

      expect(cursor.attributes('y1')).toBe(String(TOP))
      // 63.4 kg on a 60 to 80 kg axis from y 130 to 25
      expect(Number(cursor.attributes('y2')))
        .toBeCloseTo(112.15)
      expect(cursor.attributes('x1'))
        .toBe(cursor.attributes('x2'))
    })

    it('flips the tooltip near the right edge', async () => {
      const chart = mountChart()

      await hover(chart, LEFT)
      expect(chart.get('.tooltip').classes())
        .not.toContain('-flipped')
      await hover(chart, RIGHT)
      expect(chart.get('.tooltip').classes())
        .toContain('-flipped')
    })

    it('hides when the pointer leaves', async () => {
      const chart = mountChart()

      await hover(chart, LEFT)
      await chart.get('svg').trigger('pointerleave')

      expect(tooltip(chart)).toBeUndefined()
      expect(chart.find('.cursor').exists()).toBe(false)
    })

    it('hides when the Entries reload', async () => {
      const chart = mountChart()

      await hover(chart, LEFT)
      await chart.setProps({ entries: [...ENTRIES] })

      expect(tooltip(chart)).toBeUndefined()
    })
  })

  describe('the keyboard', () => {
    it('is focusable', () => {
      expect(mountChart().get('svg').attributes('tabindex'))
        .toBe('0')
    })

    it('starts from the Selected Date', async () => {
      const chart = mountChart()

      await press(chart, 'ArrowLeft')

      expect(tooltip(chart)).toBe('Jul 2, 63.4 kg')
    })

    it('steps between Entries', async () => {
      const chart = mountChart()

      await press(chart, 'ArrowRight')
      await press(chart, 'ArrowRight')
      expect(tooltip(chart)).toBe('Sep 10, 65.0 kg')
      await press(chart, 'ArrowRight')
      expect(tooltip(chart)).toBe('Sep 10, 65.0 kg')
      await press(chart, 'ArrowLeft')
      await press(chart, 'ArrowLeft')
      expect(tooltip(chart)).toBe('Mar 2, 70.0 kg')
      await press(chart, 'ArrowLeft')
      expect(tooltip(chart)).toBe('Mar 2, 70.0 kg')
    })

    it('hides on Escape and on blur', async () => {
      const chart = mountChart()

      await press(chart, 'ArrowLeft')
      await press(chart, 'Escape')
      expect(tooltip(chart)).toBeUndefined()

      await press(chart, 'ArrowLeft')
      await chart.get('svg').trigger('blur')
      expect(tooltip(chart)).toBeUndefined()
    })

    it('keeps arrows from the date header', async () => {
      const chart = mountChart()

      expect(await reachesWindow(chart, 'ArrowLeft'))
        .toBe(false)
      expect(await reachesWindow(chart, 'ArrowRight'))
        .toBe(false)
    })

    it('lets other keys through', async () => {
      const chart = mountChart()

      // Nothing shown, so Escape isn't the chart's.
      expect(await reachesWindow(chart, 'Escape'))
        .toBe(true)
      expect(await reachesWindow(chart, 't')).toBe(true)
    })
  })

  it("shades the line along itself, as Figma's", () => {
    // From Mar 2's centre to Sep 10's, both inside.
    const gradient = lineGradient(mountChart())
    expect(gradient.element.tagName).toBe('linearGradient')
    expect(gradient.attributes()).toMatchObject({
      gradientUnits: 'userSpaceOnUse',
      x1: String(LEFT + 29.5),
      x2: String(LEFT + 221.5)
    })
    expect(gradient.findAll('stop').map(stop => [
      stop.classes()[0], stop.attributes('offset')
    ])).toEqual([
      ['line-start', '0'],
      ['line-rise', '0.394231'],
      ['line-peak', '0.716346'],
      ['line-end', '0.894231']
    ])
  })

  it("keeps each chart's line gradient its own", () => {
    // Ids are unique within an app: two charts in one.
    const props = {
      day: new Date(2026, 6, 14),
      entries: ENTRIES
    }
    const page = mount(
      () => [h(WeightChart, props), h(WeightChart, props)],
      { attachTo: document.body }
    )

    const strokes = page.findAll('.line')
      .map(line => line.attributes('stroke'))
    expect(strokes).toHaveLength(2)
    expect(strokes[0]).not.toBe(strokes[1])
  })

  describe('the glow', () => {
    it('sits on the Selected Date\'s Entry', () => {
      const glow = mountChart({ day: new Date(2026, 6, 2) })
        .get('.glow')

      // 63.4 kg on a 60 to 80 kg axis from y 130 to 25
      expect(Number(glow.attributes('cy')))
        .toBeCloseTo(112.15)
    })

    it('is interpolated between Entries', () => {
      const glow = mountChart().get('.glow')
      const cy = Number(glow.attributes('cy'))

      // Between 63.4 kg (y 112.15) and 65 kg (y 103.75)
      expect(cy).toBeLessThan(112.15)
      expect(cy).toBeGreaterThan(103.75)
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
      // 63.4 kg on a 50 to 70 kg axis from y 130 to 25
      expect(Number(chart.get('.dot').attributes('cy')))
        .toBeCloseTo(59.65)
    })

    it('glows unclipped on its own day', () => {
      const glow = mountChart({
        entries: LONE,
        day: new Date(2026, 6, 2)
      }).get('.glow')

      expect(Number(glow.attributes('cy')))
        .toBeCloseTo(59.65)
      expect(glow.attributes('clip-path')).toBeUndefined()
    })

    it('snaps the tooltip to it', async () => {
      const chart = mountChart({ entries: LONE })

      await hover(chart, RIGHT)
      expect(tooltip(chart)).toBe('Jul 2, 63.4 kg')
      await press(chart, 'ArrowRight')
      expect(tooltip(chart)).toBe('Jul 2, 63.4 kg')
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

  it('shows no tooltip without Entries', async () => {
    const chart = mountChart({ entries: [] })

    await hover(chart, LEFT)
    await press(chart, 'ArrowRight')

    expect(tooltip(chart)).toBeUndefined()
    expect(chart.find('.cursor').exists()).toBe(false)
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
    // Its gradient spans only what the plot shows.
    const gradient = lineGradient(chart)
    expect(gradient.attributes('x1')).toBe(String(LEFT))
    expect(gradient.attributes('x2')).toBe(String(RIGHT))
  })

  it('says when loading failed', () => {
    const chart = mountChart({ entries: [], failed: true })

    expect(chart.get('[role="alert"]').text())
      .toBe('Couldn\'t load your weight')
  })
})
