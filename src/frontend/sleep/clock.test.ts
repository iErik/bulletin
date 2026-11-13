import { describe, expect, it } from 'vitest'
import { endFrom, parseClock, startOn } from './clock'

describe('parseClock', () => {
  it.each([
    ['2:15', 2, 15],
    ['02:15', 2, 15],
    ['14:20', 14, 20],
    ['7', 7, 0],
    ['2:15 AM', 2, 15],
    ['2:15 PM', 14, 15],
    ['12:05 am', 0, 5],
    ['12 p.m.', 12, 0],
    [' 9.30pm ', 21, 30]
  ])('reads %j', (text, hours, minutes) => {
    expect(parseClock(text)).toEqual({ hours, minutes })
  })

  it.each(['', 'soon', '24:00', '2:60', '13 PM', '0 AM'])(
    'refuses %j',
    text => {
      expect(parseClock(text)).toBeNull()
    }
  )
})

const at = (
  day: number,
  hour: number,
  minute = 0
): number =>
  new Date(2026, 10, day, hour, minute).getTime()

describe('startOn', () => {
  const day = new Date(2026, 10, 7)

  it.each([
    ['the morning', 2, 15],
    ['the evening', 23, 10]
  ])('puts %s on the day itself', (_, hours, minutes) => {
    expect(startOn(day, { hours, minutes }))
      .toBe(at(7, hours, minutes))
  })
})

describe('endFrom', () => {
  it('takes the same day when later', () => {
    expect(endFrom(at(8, 2), { hours: 9, minutes: 5 }))
      .toBe(at(8, 9, 5))
  })

  it('takes the next day when earlier', () => {
    expect(endFrom(at(7, 23), { hours: 7, minutes: 0 }))
      .toBe(at(8, 7))
  })

  it('takes the next day when equal', () => {
    expect(endFrom(at(8, 2), { hours: 2, minutes: 0 }))
      .toBe(at(9, 2))
  })
})
