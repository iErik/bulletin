import { describe, expect, it, vi } from 'vitest'
import { localDate } from '@shared/dates'
import type { SleepPeriod } from '@shared/sleep'
import type { StorageResult } from '@shared/storage'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { useSleepMonths } from './use-sleep-months'

type Listed = StorageResult<SleepPeriod[]>

const listing = (
  ...periods: SleepPeriod[]
): Listed => ({ ok: true, value: periods })

const period = (id: number, start: number): SleepPeriod =>
  ({ id, start, end: start + 3_600_000 })

// Months are 0-based; today is November 9th, 2026.
const day = (month: number, date: number): Date =>
  new Date(2026, month, date)

const months = (): ReturnType<typeof useSleepMonths> =>
  useSleepMonths(() => day(10, 9))

const range = (
  sleep: ReturnType<typeof useSleepMonths>
): string[] => {
  const days = sleep.days.value
  return [localDate(days[0]), localDate(days.at(-1)!)]
}

describe('useSleepMonths', () => {
  useFixedToday()

  it('starts empty', () => {
    const sleep = months()

    expect(sleep.days.value).toEqual([])
    expect(sleep.contains(day(10, 9))).toBe(false)
  })

  it("loads a day's month and its neighbours", async () => {
    const api = stubBulletin()
    const sleep = months()

    await sleep.reset(day(9, 15))

    // From the day before, whose Period may continue
    // onto the first row, to the day after, whose
    // morning is on the last row.
    expect(api.sleep.list).toHaveBeenCalledWith({
      from: '2026-09-01',
      to: '2026-11-30'
    })
    expect(range(sleep))
      .toEqual(['2026-09-01', '2026-11-30'])
    expect(sleep.contains(day(8, 1))).toBe(true)
    expect(sleep.contains(day(7, 31))).toBe(false)
  })

  it('stops at the end of this month', async () => {
    const sleep = months()

    await sleep.reset(day(10, 9))

    expect(range(sleep))
      .toEqual(['2026-10-01', '2026-11-30'])
    expect(await sleep.loadLater()).toBe(false)
    expect(window.bulletin.sleep.list)
      .toHaveBeenCalledTimes(1)
  })

  it('adds earlier and later months', async () => {
    const api = stubBulletin()
    const sleep = months()
    await sleep.reset(day(6, 15))

    expect(await sleep.loadEarlier()).toBe(true)
    expect(await sleep.loadLater()).toBe(true)

    expect(api.sleep.list).toHaveBeenCalledWith({
      from: '2026-05-01',
      to: '2026-05-31'
    })
    expect(api.sleep.list).toHaveBeenCalledWith({
      from: '2026-09-01',
      to: '2026-09-30'
    })
    expect(range(sleep))
      .toEqual(['2026-05-01', '2026-09-30'])
  })

  it('keeps each Period once, oldest first', async () => {
    const june = period(1, day(5, 30).getTime())
    const july = period(2, day(6, 2).getTime())
    const api = stubBulletin()
    vi.mocked(api.sleep.list)
      .mockResolvedValueOnce(listing(july))
      .mockResolvedValueOnce(listing(june, july))
    const sleep = months()

    await sleep.reset(day(7, 15))
    await sleep.loadEarlier()

    expect(sleep.periods.value).toEqual([june, july])
  })

  it('replaces the Periods on a reset', async () => {
    const api = stubBulletin()
    vi.mocked(api.sleep.list).mockResolvedValueOnce(
      listing(period(1, day(9, 2).getTime()))
    )
    const sleep = months()

    await sleep.reset(day(9, 15))
    await sleep.reset(day(0, 15))

    expect(sleep.periods.value).toEqual([])
  })

  it('drops a load a reset overtook', async () => {
    const api = stubBulletin()
    const sleep = months()
    await sleep.reset(day(9, 15))
    let finish: (result: Listed) => void = () => {}
    vi.mocked(api.sleep.list).mockReturnValueOnce(
      new Promise(resolve => finish = resolve)
    )

    const earlier = sleep.loadEarlier()
    await sleep.reset(day(2, 15))
    finish(
      listing(period(9, day(7, 2).getTime()))
    )

    expect(await earlier).toBe(false)
    expect(range(sleep))
      .toEqual(['2026-02-01', '2026-04-30'])
    expect(sleep.periods.value).toEqual([])
  })

  it('reports a failed load', async () => {
    const api = stubBulletin()
    const sleep = months()
    await sleep.reset(day(9, 15))
    vi.mocked(api.sleep.list).mockResolvedValueOnce({
      ok: false,
      error: { code: 'internal' }
    })

    expect(await sleep.loadEarlier()).toBe(false)
    expect(sleep.failed.value).toBe(true)
    expect(range(sleep))
      .toEqual(['2026-09-01', '2026-11-30'])
  })

  it('adds a saved Period in order', async () => {
    const api = stubBulletin()
    const early = period(1, day(10, 2).getTime())
    const late = period(2, day(10, 6).getTime())
    vi.mocked(api.sleep.list)
      .mockResolvedValueOnce(listing(early, late))
    const sleep = months()
    await sleep.reset(day(10, 9))

    const added = period(3, day(10, 4).getTime())
    sleep.add(added)

    expect(sleep.periods.value)
      .toEqual([early, added, late])
  })

  it('replaces a moved Period by its id', async () => {
    const api = stubBulletin()
    const first = period(1, day(10, 2).getTime())
    vi.mocked(api.sleep.list)
      .mockResolvedValueOnce(listing(first))
    const sleep = months()
    await sleep.reset(day(10, 9))

    const moved = { ...first, end: first.end + 60_000 }
    sleep.add(moved)

    expect(sleep.periods.value).toEqual([moved])
  })
  it('drops a deleted Period', async () => {
    const api = stubBulletin()
    const first = period(1, day(10, 2).getTime())
    const second = period(2, day(10, 6).getTime())
    vi.mocked(api.sleep.list)
      .mockResolvedValueOnce(listing(first, second))
    const sleep = months()
    await sleep.reset(day(10, 9))

    sleep.remove(1)

    expect(sleep.periods.value).toEqual([second])
  })
})
