import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import {
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { SleepApi, SleepPeriod } from '@shared/sleep'
import type { DateRange } from '@shared/storage'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import SleepTimeline from './SleepTimeline.vue'

// happy-dom has no layout: rows are ROW tall, stacked
// in order, in a list VIEW tall.
const ROW = 50
const VIEW = 400

const fakeLayout = (): void => {
  const index = (el: Element): number =>
    [...el.parentElement!.children].indexOf(el)
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return this.dataset.day ? index(this) * ROW : 0
    })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
    .mockReturnValue(ROW)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get')
    .mockReturnValue(VIEW)
  vi.spyOn(Element.prototype, 'scrollHeight', 'get')
    .mockImplementation(function (this: Element) {
      return this.childElementCount * ROW
    })
}

const at = (
  month: number,
  day: number,
  h: number,
  m = 0
): number => new Date(2026, month, day, h, m).getTime()

/** Sleep storage holding `periods`, listed by Head. */
const storing = (
  periods: SleepPeriod[]
): SleepApi['list'] =>
  vi.fn(async ({ from, to }: DateRange) => {
    const key = (time: number): string => {
      const d = new Date(time - 12 * 3_600_000)
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
      ].join('-')
    }
    return {
      ok: true as const,
      value: periods.filter(p =>
        key(p.start) >= from && key(p.start) <= to)
    }
  })

let timeline: VueWrapper | undefined

const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await nextTick()
}

interface Mounted {
  timeline: VueWrapper
  store: ReturnType<typeof useSelectedDateStore>
  list: HTMLElement
}

const mountTimeline = async (): Promise<Mounted> => {
  const pinia = createPinia()
  setActivePinia(pinia)
  timeline = mount(SleepTimeline, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await settle()
  return {
    timeline,
    store: useSelectedDateStore(),
    list: timeline.get<HTMLElement>('.rows').element
  }
}

const row = (
  key: string
): Omit<DOMWrapper<Element>, 'exists'> =>
  timeline!.get(`[data-day="${key}"]`)

const keys = (): string[] =>
  timeline!.findAll('.day-row')
    .map(r => r.attributes('data-day')!)

/** The scrollTop that centres the row at `index`. */
const centred = (index: number): number =>
  index * ROW - (VIEW - ROW) / 2

// Months are 0-based; today is November 9th, 2026.
describe('SleepTimeline', () => {
  useFixedToday()
  beforeEach(fakeLayout)

  afterEach(() => {
    timeline?.unmount()
    timeline = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('lists last month to the end of this one', async () => {
    const api = stubBulletin()
    await mountTimeline()

    expect(api.sleep.list).toHaveBeenCalledWith({
      from: '2026-09-30',
      to: '2026-11-30'
    })
    expect(keys()[0]).toBe('2026-10-01')
    expect(keys().at(-1)).toBe('2026-11-30')
    expect(keys()).toHaveLength(31 + 30)
  })

  it('dims and disables the days after today', async () => {
    await mountTimeline()

    expect(row('2026-11-09').classes())
      .not.toContain('-future')
    for (const day of ['10', '30']) {
      const future = row(`2026-11-${day}`)
      expect(future.classes()).toContain('-future')
      expect(future.attributes('aria-disabled'))
        .toBe('true')
    }
  })

  it("draws a Period in its Head's row", async () => {
    const night = { id: 1, start: at(10, 8, 1), end: at(10, 8, 9) }
    stubBulletin({ sleep: {
      ...stubBulletin().sleep,
      list: storing([night])
    } })
    await mountTimeline()

    const period = row('2026-11-07').get('.period')
    expect(period.classes())
      .toEqual(['period', '-head', '-tail'])
    expect(period.attributes('style'))
      .toContain('left: 54.1666')
    expect(row('2026-11-07').get('.caption').text())
      .toMatch(/^1:00\sAM to 9:00\sAM$/)
    expect(row('2026-11-08').find('.period').exists())
      .toBe(false)
    expect(row('2026-11-08').find('.caption').exists())
      .toBe(false)
  })

  it('continues a Period past noon', async () => {
    stubBulletin({ sleep: {
      ...stubBulletin().sleep,
      list: storing([{
        id: 1,
        start: at(10, 8, 6),
        end: at(10, 8, 15)
      }])
    } })
    await mountTimeline()

    expect(row('2026-11-07').get('.period').classes())
      .toEqual(['period', '-head'])
    expect(row('2026-11-08').get('.period').classes())
      .toEqual(['period', '-tail'])
  })

  it('totals several Periods in the caption', async () => {
    stubBulletin({ sleep: {
      ...stubBulletin().sleep,
      list: storing([
        { id: 1, start: at(10, 8, 0), end: at(10, 8, 6) },
        { id: 2, start: at(10, 8, 7), end: at(10, 8, 9, 5) }
      ])
    } })
    await mountTimeline()

    expect(row('2026-11-07').get('.caption').text())
      .toBe('8h 05m · 2 periods')
  })

  it('labels the axis on the Locale clock', async () => {
    await mountTimeline()

    const ticks = timeline!.findAll('.axis .tick')
    expect(ticks).toHaveLength(9)
    expect(ticks[0].text()).toMatch(/^12:00\sPM$/)
    expect(ticks[4].text()).toMatch(/^12:00\sAM$/)
  })

  it("centres the Selected Date's row", async () => {
    const { store, list } = await mountTimeline()

    expect(row('2026-11-09').classes())
      .toContain('-selected')
    expect(list.scrollTop)
      .toBe(centred(keys().indexOf('2026-11-09')))

    store.step(-1)
    await settle()
    expect(list.scrollTop)
      .toBe(centred(keys().indexOf('2026-11-08')))
  })

  it('jumps to a month outside the list', async () => {
    const { store, list } = await mountTimeline()
    const api = window.bulletin

    store.setDay(new Date(2026, 0, 15))
    await settle()

    expect(api.sleep.list).toHaveBeenLastCalledWith({
      from: '2025-11-30',
      to: '2026-02-28'
    })
    expect(keys()[0]).toBe('2025-12-01')
    expect(list.scrollTop)
      .toBe(centred(keys().indexOf('2026-01-15')))
  })

  it('loads earlier months without jumping', async () => {
    const { store, timeline, list } =
      await mountTimeline()
    list.scrollTop = 10

    await timeline.get('.rows').trigger('scroll')
    await settle()

    expect(window.bulletin.sleep.list)
      .toHaveBeenLastCalledWith({
        from: '2026-08-31',
        to: '2026-09-30'
      })
    expect(keys()[0]).toBe('2026-09-01')
    expect(list.scrollTop).toBe(10 + 30 * ROW)
    expect(store.isToday).toBe(true)
  })

  it('loads later months up to this one', async () => {
    const { store, timeline, list } =
      await mountTimeline()
    store.setDay(new Date(2026, 6, 15))
    await settle()
    const bottom = (): void => {
      list.scrollTop = list.scrollHeight - VIEW
    }

    bottom()
    await timeline.get('.rows').trigger('scroll')
    await settle()
    expect(keys().at(-1)).toBe('2026-09-30')

    const calls = vi.mocked(window.bulletin.sleep.list)
    store.setDay(new Date(2026, 9, 15))
    await settle()
    bottom()
    await timeline.get('.rows').trigger('scroll')
    await settle()
    bottom()
    await timeline.get('.rows').trigger('scroll')
    await settle()
    expect(keys().at(-1)).toBe('2026-11-30')
    expect(calls.mock.calls.flat().map(r => r.to))
      .not.toContain('2026-12-31')
    expect(store.day).toEqual(new Date(2026, 9, 15))
  })

  it('says so when storage fails', async () => {
    stubBulletin({ sleep: {
      ...stubBulletin().sleep,
      list: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'internal' }
      })
    } })
    await mountTimeline()

    expect(timeline!.get('[role="alert"]').text())
      .toBe("Couldn't load sleep.")
    expect(keys()).toHaveLength(61)
  })
})
