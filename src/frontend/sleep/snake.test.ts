import { describe, expect, it } from 'vitest'
import {
  periodPath,
  pointAt,
  snakeLayout,
  snakePath,
  stretchPath,
  stretchSpan,
  timeAt,
  type SnakeLayout
} from './snake'

/** November `day`, 2026, at `h:m` local time. */
const at = (day: number, h: number, m = 0): number =>
  new Date(2026, 10, day, h, m).getTime()

const FIRST = new Date(2026, 10, 7)

// Rows from 100 to 650 (50 px an hour), AM rows 60 px
// apart, so curves have a radius of 15.
const LAYOUT: SnakeLayout = {
  left: 100,
  right: 650,
  top: 40,
  gap: 30
}

const point = (time: number): [number, number] => {
  const { x, y } = pointAt(time, FIRST, LAYOUT)
  return [+x.toFixed(3), +y.toFixed(3)]
}

describe('snake', () => {
  it.each([
    ['1:00 at the AM row\'s left end', at(7, 1), [100, 40]],
    ['6:30 on the AM row', at(7, 6, 30), [375, 40]],
    ['noon at its right end', at(7, 12), [650, 40]],
    ['12:30 at the right curve\'s edge', at(7, 12, 30), [665, 55]],
    ['13:00 at the PM row\'s right end', at(7, 13), [650, 70]],
    ['18:30 on the PM row', at(7, 18, 30), [375, 70]],
    ['midnight at its left end', at(8, 0), [100, 70]],
    ['0:30 at the left curve\'s edge', at(8, 0, 30), [85, 85]],
    ['the next day\'s 1:00', at(8, 1), [100, 100]]
  ] as const)('puts %s', (_, time, expected) => {
    expect(point(time)).toEqual(expected)
  })

  it('makes an hour a row\'s length over 11', () => {
    const [x2] = point(at(7, 2))
    const [x3] = point(at(7, 3))

    expect(x3 - x2).toBeCloseTo(550 / 11)
  })

  it.each([
    ['the AM row', at(7, 4, 15)],
    ['the right curve', at(7, 12, 20)],
    ['the PM row', at(7, 21, 45)],
    ['the left curve', at(8, 0, 40)],
    ['a later day', at(10, 7, 5)]
  ])('turns a point on %s back into its time', (_, time) => {
    expect(timeAt(pointAt(time, FIRST, LAYOUT), FIRST, LAYOUT))
      .toBe(time)
  })

  it('snaps a point near a row onto it', () => {
    expect(timeAt({ x: 375, y: 46 }, FIRST, LAYOUT))
      .toBe(at(7, 6, 30))
    expect(timeAt({ x: 375, y: 64 }, FIRST, LAYOUT))
      .toBe(at(7, 18, 30))
  })

  it('clamps a point past a row\'s end onto the curve', () => {
    expect(timeAt({ x: 700, y: 55 }, FIRST, LAYOUT))
      .toBe(at(7, 12, 30))
  })

  it('draws a Period within a row as one line', () => {
    expect(periodPath(
      { id: 1, start: at(7, 2), end: at(7, 7) },
      FIRST,
      LAYOUT
    )).toBe('M 150 40 L 400 40')
  })

  it('draws a Period across noon round the right curve', () => {
    expect(stretchPath(at(7, 6), at(7, 15), FIRST, LAYOUT))
      .toBe('M 350 40 L 650 40 A 15 15 0 0 1 650 70 L 550 70')
  })

  it('draws a night across midnight round the left curve',
    () => {
      expect(stretchPath(at(7, 23), at(8, 7), FIRST, LAYOUT))
        .toBe('M 150 70 L 100 70 A 15 15 0 0 0 100 100 '
          + 'L 400 100')
    })

  it('starts and ends a stretch inside a curve', () => {
    expect(stretchPath(
      at(7, 12, 30),
      at(8, 0, 30),
      FIRST,
      LAYOUT
    )).toBe('M 665 55 A 15 15 0 0 1 650 70 L 100 70 '
      + 'A 15 15 0 0 0 85 85')
  })

  it('draws the whole snake from 1:00 to the last midnight',
    () => {
      const path = snakePath(FIRST, 2, LAYOUT)

      expect(path.startsWith('M 100 40 L 650 40 A')).toBe(true)
      expect(path.endsWith('L 100 130')).toBe(true)
      expect(path.match(/ A /g)).toHaveLength(3)
    })

  it('fits the curves inside the width, 10 px in', () => {
    expect(snakeLayout(600)).toEqual({
      left: 24.25,
      right: 575.75,
      top: 23,
      gap: 28.5
    })
  })

  it('spans a stretch from its leftmost to rightmost x',
    () => {
      expect(stretchSpan(at(7, 2), at(7, 7), FIRST, LAYOUT))
        .toEqual({ left: 150, right: 400 })
      // Round the right curve, past the row's end.
      expect(stretchSpan(at(7, 6), at(7, 15), FIRST, LAYOUT))
        .toEqual({ left: 350, right: 665 })
    })
})
