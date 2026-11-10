import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSelectedDateStore } from './selected-date'

// Months are 0-based: 10 is November.
const day = (date: number, month = 10): Date =>
  new Date(2026, month, date)

const freshStore = () => {
  setActivePinia(createPinia())
  return useSelectedDateStore()
}

describe('useSelectedDateStore', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      now: new Date(2026, 10, 9, 15, 30)
    })
  })

  afterEach(() => vi.useRealTimers())

  it('opens on today, with no time of day', () => {
    const store = freshStore()

    expect(store.day).toEqual(day(9))
    expect(store.today).toEqual(day(9))
    expect(store.isToday).toBe(true)
  })

  it('selects a past day at midnight', () => {
    const store = freshStore()

    store.setDay(new Date(2026, 9, 12, 18, 45))

    expect(store.day).toEqual(day(12, 9))
    expect(store.isToday).toBe(false)
  })

  it.each([
    ['tomorrow', day(10)],
    ['next year', new Date(2027, 0, 1)],
    ['later today', new Date(2026, 10, 9, 23, 59)]
  ])('clamps %s to today', (_, date) => {
    const store = freshStore()
    store.setDay(day(1))

    store.setDay(date)

    expect(store.day).toEqual(day(9))
  })

  it('steps back and forward one day', () => {
    const store = freshStore()

    store.step(-1)
    store.step(-1)
    expect(store.day).toEqual(day(7))

    store.step(1)
    expect(store.day).toEqual(day(8))
  })

  it('steps across a month boundary', () => {
    const store = freshStore()
    store.setDay(day(1))

    store.step(-1)

    expect(store.day).toEqual(day(31, 9))
  })

  it('never steps past today', () => {
    const store = freshStore()

    store.step(1)

    expect(store.day).toEqual(day(9))
  })

  it('goes back to today from another day', () => {
    const store = freshStore()
    store.setDay(day(2, 3))

    store.goToday()

    expect(store.day).toEqual(day(9))
    expect(store.isToday).toBe(true)
  })

  it('follows today across midnight', () => {
    const store = freshStore()

    // 15:30 to 00:30.
    vi.advanceTimersByTime(9 * 3_600_000)

    expect(store.day).toEqual(day(10))
    expect(store.today).toEqual(day(10))
    expect(store.isToday).toBe(true)
  })

  it('keeps an earlier day across midnight', () => {
    const store = freshStore()
    store.setDay(day(3))

    vi.advanceTimersByTime(24 * 3_600_000)

    expect(store.day).toEqual(day(3))
    expect(store.today).toEqual(day(10))
    expect(store.isToday).toBe(false)
  })

  it('rolls over again the next midnight', () => {
    const store = freshStore()

    vi.advanceTimersByTime(2 * 24 * 3_600_000)

    expect(store.day).toEqual(day(11))
  })

  it('opens on today again after a restart', () => {
    freshStore().setDay(day(1))

    expect(freshStore().day).toEqual(day(9))
    expect(localStorage.length).toBe(0)
  })
})
