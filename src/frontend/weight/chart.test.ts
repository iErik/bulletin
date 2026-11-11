import { describe, expect, it } from 'vitest'
import { curveMonotoneX, line } from 'd3-shape'
import type { WeightEntry } from '@shared/weight'
import {
  chartPoints,
  chartWindow,
  curveAt,
  dayX,
  loadRange,
  nearestIndex,
  windowDays,
  yDomain,
  yTicks
} from './chart'

const entry = (date: string, kg: number): WeightEntry =>
  ({ date, grams: kg * 1000 })

describe('chartWindow', () => {
  it('spans five months each side of the month', () => {
    const window = chartWindow(new Date(2026, 6, 14))

    expect(window.months).toHaveLength(11)
    expect(window.months[0]).toEqual(new Date(2026, 1, 1))
    expect(window.months[5]).toEqual(new Date(2026, 6, 1))
    expect(window.months[10])
      .toEqual(new Date(2026, 11, 1))
    expect(window.start).toEqual(new Date(2026, 1, 1))
    expect(window.end).toEqual(new Date(2026, 11, 31))
    expect(windowDays(window)).toBe(334)
  })

  it('crosses years', () => {
    const window = chartWindow(new Date(2026, 1, 3))

    expect(window.start).toEqual(new Date(2025, 8, 1))
    expect(window.end).toEqual(new Date(2026, 6, 31))
  })

  it('loads a year past each edge', () => {
    const window = chartWindow(new Date(2026, 6, 14))

    expect(loadRange(window)).toEqual({
      from: '2025-02-01',
      to: '2027-12-31'
    })
  })
})

describe('chartPoints', () => {
  const window = chartWindow(new Date(2026, 6, 14))

  it('places Entries at their days\' centres', () => {
    const { visible } = chartPoints(window, [
      entry('2026-02-01', 70),
      entry('2026-02-03', 69.5)
    ])

    expect(visible.map(p => [p.x, p.y]))
      .toEqual([[0.5, 70], [2.5, 69.5]])
  })

  it('adds only the nearest Entry outside each edge', () => {
    const { visible, curve } = chartPoints(window, [
      entry('2025-12-01', 72),
      entry('2026-01-31', 71),
      entry('2026-03-10', 70),
      entry('2027-01-01', 66),
      entry('2027-02-01', 65)
    ])

    expect(visible.map(p => p.entry.date))
      .toEqual(['2026-03-10'])
    expect(curve.map(p => p.entry.date)).toEqual([
      '2026-01-31',
      '2026-03-10',
      '2027-01-01'
    ])
  })
})

describe('yDomain', () => {
  it.each([
    [[], [40, 80]],
    [[63.4], [50, 70]],
    [[67.5], [60, 80]],
    [[61.2, 74.9], [60, 80]],
    [[58, 92], [50, 100]],
    [[60], [50, 70]]
  ])(
    'rounds %j out to 10 kg, at least 20 kg wide',
    (values, domain) => {
      expect(yDomain(values)).toEqual(domain)
    }
  )

  it('grows a 10 kg range on the values\' side', () => {
    expect(yDomain([61, 62])).toEqual([50, 70])
    expect(yDomain([68, 69])).toEqual([60, 80])
  })

  it('labels every 10 kg', () => {
    expect(yTicks([40, 80])).toEqual([40, 50, 60, 70, 80])
  })
})

describe('nearestIndex', () => {
  const points = [{ x: 1, y: 0 }, { x: 5, y: 0 }]

  it('finds the nearest point', () => {
    expect(nearestIndex(points, 2.9)).toBe(0)
    expect(nearestIndex(points, 3.1)).toBe(1)
    expect(nearestIndex(points, 99)).toBe(1)
  })

  it('is -1 with no points', () => {
    expect(nearestIndex([], 3)).toBe(-1)
  })
})

describe('curveAt', () => {
  const points = [
    { x: 0.5, y: 70 },
    { x: 20.5, y: 72 },
    { x: 30.5, y: 72 },
    { x: 60.5, y: 64 },
    { x: 75.5, y: 66 }
  ]

  it('passes through every point', () => {
    for (const p of points)
      expect(curveAt(points, p.x)).toBeCloseTo(p.y)
  })

  it('never overshoots between points', () => {
    for (let x = 0.5; x <= 75.5; x += 0.25) {
      const y = curveAt(points, x)!
      const i = points.findIndex(p => p.x >= x)
      const [a, b] = [points[Math.max(i - 1, 0)], points[i]]
      expect(y).toBeGreaterThanOrEqual(
        Math.min(a.y, b.y) - 1e-9
      )
      expect(y).toBeLessThanOrEqual(
        Math.max(a.y, b.y) + 1e-9
      )
    }
  })

  it('matches d3\'s monotone curve', () => {
    // d3 draws `Mx0,y0Cc1x,c1y,c2x,c2y,x1,y1C…`, and a
    // cubic Bézier's midpoint is (p0+3c1+3c2+p1)/8.
    const path = line<{ x: number; y: number }>()
      .x(p => p.x)
      .y(p => p.y)
      .curve(curveMonotoneX)(points)!
    const segments = path.slice(1).split('C').slice(1)
      .map(segment => segment.split(',').map(Number))

    segments.forEach(([, c1y, , c2y], i) => {
      const [a, b] = [points[i], points[i + 1]]
      expect(curveAt(points, (a.x + b.x) / 2))
        .toBeCloseTo((a.y + 3 * c1y + 3 * c2y + b.y) / 8)
    })
    expect(segments).toHaveLength(points.length - 1)
  })

  it('is undefined outside the points', () => {
    expect(curveAt(points, 0.4)).toBeUndefined()
    expect(curveAt(points, 76)).toBeUndefined()
    expect(curveAt([], 1)).toBeUndefined()
  })

  it('is the point itself with one point', () => {
    expect(curveAt([{ x: 3.5, y: 63 }], 3.5)).toBe(63)
  })

  it('is a line between two points', () => {
    const two = [{ x: 0, y: 60 }, { x: 10, y: 70 }]
    expect(curveAt(two, 2.5)).toBeCloseTo(62.5)
  })

  it('works with dayX on real dates', () => {
    const window = chartWindow(new Date(2026, 6, 14))
    expect(dayX(window, new Date(2026, 6, 14)))
      .toBe(163.5)
  })
})
