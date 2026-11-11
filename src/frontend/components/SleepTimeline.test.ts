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
import { localDate } from '@shared/dates'
import { rowOf } from '@/sleep/timeline'
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

/** Epoch ms of `hour`:`minute` on a 2026 day. */
const at = (
  month: number,
  day: number,
  hour: number,
  minute = 0
): number =>
  new Date(2026, month, day, hour, minute).getTime()

/**
 * Stubs sleep storage holding `periods`, listed by the
 * row of their Head, as the real storage does.
 */
const storing = (periods: SleepPeriod[]): void => {
  const list: SleepApi['list'] = vi.fn(
    async ({ from, to }: DateRange) => ({
      ok: true as const,
      value: periods.filter(p => {
        const key = localDate(rowOf(p.start))
        return key >= from && key <= to
      })
    })
  )
  stubBulletin({ sleep: { ...stubBulletin().sleep, list } })
}

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
    storing([
      { id: 1, start: at(10, 8, 1), end: at(10, 8, 9) }
    ])
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
    storing([
      { id: 1, start: at(10, 8, 6), end: at(10, 8, 15) }
    ])
    await mountTimeline()

    expect(row('2026-11-07').get('.period').classes())
      .toEqual(['period', '-head'])
    expect(row('2026-11-08').get('.period').classes())
      .toEqual(['period', '-tail'])
  })

  it('totals several Periods in the caption', async () => {
    storing([
      { id: 1, start: at(10, 8, 0), end: at(10, 8, 6) },
      { id: 2, start: at(10, 8, 7), end: at(10, 8, 9, 5) }
    ])
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

  it('adds the new month at midnight', async () => {
    const { store } = await mountTimeline()
    store.setDay(new Date(2026, 10, 5))
    await settle()

    // To 3:30 PM on December 1st, past 22 midnights.
    await vi.advanceTimersByTimeAsync(22 * 86_400_000)
    await settle()

    expect(keys().at(-1)).toBe('2026-12-31')
    expect(row('2026-12-01').classes())
      .not.toContain('-future')
    expect(store.day).toEqual(new Date(2026, 10, 5))
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

// A track 288px wide: one pixel per 5 minutes, from
// noon at 0 to noon the next day at 288.
const fakeTrack = (): void => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect')
    .mockReturnValue(
      { left: 0, width: 288 } as DOMRect
    )
}

/** The x of `h:m` on a row, `h` counted from noon. */
const x = (h: number, m = 0): number =>
  ((h - 12) * 60 + m) / 5

const track = (key: string): DOMWrapper<Element> =>
  row(key).get('.track') as DOMWrapper<Element>

const move = (
  key: string,
  clientX: number
): Promise<void> =>
  track(key).trigger('pointermove', { clientX })

const click = async (
  key: string,
  clientX: number
): Promise<void> => {
  await move(key, clientX)
  await track(key).trigger('click', { clientX })
  await settle()
}

const hover = (key: string): string =>
  row(key).get('.hover').text()

describe('SleepTimeline, creating', () => {
  useFixedToday()
  beforeEach(() => {
    fakeLayout()
    fakeTrack()
  })

  afterEach(() => {
    timeline?.unmount()
    timeline = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('shows the snapped time on hover', async () => {
    await mountTimeline()

    await move('2026-11-07', x(23, 2))
    expect(hover('2026-11-07')).toMatch(/^11:00\sPM$/)

    await move('2026-11-07', x(24 + 6, 3))
    expect(hover('2026-11-07')).toMatch(/^6:05\sAM$/)

    await track('2026-11-07').trigger('pointerleave')
    expect(row('2026-11-07').find('.hover').exists())
      .toBe(false)
  })

  it('shows no time over a Period', async () => {
    storing([
      { id: 1, start: at(10, 8, 1), end: at(10, 8, 9) }
    ])
    await mountTimeline()

    await move('2026-11-07', x(24 + 4))
    expect(row('2026-11-07').find('.hover').exists())
      .toBe(false)
  })

  it('creates a Period with two clicks', async () => {
    const api = stubBulletin()
    await mountTimeline()

    await click('2026-11-07', x(23))
    await move('2026-11-08', x(13))
    expect(row('2026-11-07').get('.-preview').classes())
      .toContain('-head')
    expect(row('2026-11-08').get('.-preview').classes())
      .toContain('-tail')

    await click('2026-11-08', x(13))
    expect(api.sleep.create).toHaveBeenCalledWith({
      start: at(10, 7, 23),
      end: at(10, 8, 13)
    })
    expect(timeline!.find('.-preview').exists())
      .toBe(false)
    expect(row('2026-11-07').get('.caption').text())
      .toMatch(/^11:00\sPM to 1:00\sPM$/)
  })

  it('keeps a new Head out of the red', async () => {
    await mountTimeline()

    await click('2026-11-07', x(23))
    expect(row('2026-11-07').get('.-preview').classes())
      .not.toContain('-broken')

    await click('2026-11-07', x(23))
    expect(hover('2026-11-07'))
      .toBe('It ends where it starts')
  })

  it('swaps clicks in reverse order', async () => {
    const api = stubBulletin()
    await mountTimeline()

    await click('2026-11-08', x(13))
    await click('2026-11-07', x(23))

    expect(api.sleep.create).toHaveBeenCalledWith({
      start: at(10, 7, 23),
      end: at(10, 8, 13)
    })
  })

  // Each from a Head on `from`'s row to `key`'s row.
  it.each([
    ['overlapping', '2026-11-06', '2026-11-06',
      x(24 + 4), 'It overlaps another period'],
    ['over 24 hours', '2026-11-05', '2026-11-06',
      x(24 + 1), "It's over 24 hours"],
    ['in the future', '2026-11-08', '2026-11-09',
      x(16), 'It ends in the future']
  ])('refuses a Period %s', async (
    _,
    from,
    key,
    end,
    text
  ) => {
    // 1 AM to 9 AM on the 7th, in row "6th".
    storing([
      { id: 1, start: at(10, 7, 1), end: at(10, 7, 9) }
    ])
    await mountTimeline()
    const api = window.bulletin

    await click(from, x(23, 30))
    await move(key, end)
    expect(row(key).get('.-preview').classes())
      .toContain('-broken')

    await click(key, end)
    expect(hover(key)).toBe(text)
    expect(api.sleep.create).not.toHaveBeenCalled()
    expect(timeline!.find('.-preview').exists())
      .toBe(true)
  })

  it('refuses a Head in the future', async () => {
    await mountTimeline()

    await click('2026-11-09', x(16))

    expect(hover('2026-11-09'))
      .toBe('It ends in the future')
    await move('2026-11-08', x(23))
    expect(timeline!.find('.-preview').exists())
      .toBe(false)
  })

  it('cancels on Escape', async () => {
    await mountTimeline()
    await click('2026-11-07', x(23))
    await move('2026-11-07', x(24 + 2))

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape' })
    )
    await settle()

    expect(timeline!.find('.-preview').exists())
      .toBe(false)
  })

  it('cancels on a click outside', async () => {
    const api = stubBulletin()
    await mountTimeline()
    await click('2026-11-07', x(23))
    await move('2026-11-07', x(24 + 2))

    document.body.click()
    await settle()
    await click('2026-11-07', x(24 + 3))

    expect(timeline!.find('.-preview').exists())
      .toBe(true)
    expect(api.sleep.create).not.toHaveBeenCalled()
  })

  it('shows a storage error inline', async () => {
    stubBulletin({ sleep: {
      ...stubBulletin().sleep,
      create: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'overlapping-period' }
      })
    } })
    await mountTimeline()

    await click('2026-11-07', x(23))
    await click('2026-11-07', x(24 + 6))

    expect(timeline!.get('[role="alert"]').text()).toBe(
      "Couldn't save the period. "
      + 'It overlaps another period.'
    )
    expect(timeline!.find('.-preview').exists())
      .toBe(false)
    expect(row('2026-11-07').find('.period').exists())
      .toBe(false)
  })
})

/** Presses `key`'s Head or Tail and moves to `to`. */
const grab = async (
  key: string,
  end: 'start' | 'end',
  to: [string, number]
): Promise<void> => {
  await row(key).get(`.handle.-${end}`)
    .trigger('pointerdown')
  await move(...to)
}

const release = async (): Promise<void> => {
  window.dispatchEvent(new Event('pointerup'))
  await settle()
}

describe('SleepTimeline, dragging', () => {
  useFixedToday()
  beforeEach(() => {
    fakeLayout()
    fakeTrack()
  })

  afterEach(() => {
    timeline?.unmount()
    timeline = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  // 1 AM to 9 AM on the 8th, in row "7th".
  const period = {
    id: 1,
    start: at(10, 8, 1),
    end: at(10, 8, 9)
  }

  it('moves the Tail and saves on release', async () => {
    storing([period])
    await mountTimeline()
    const api = window.bulletin

    await grab('2026-11-07', 'end',
      ['2026-11-07', x(24 + 10, 2)])
    expect(hover('2026-11-07')).toMatch(/^10:00\sAM$/)
    expect(api.sleep.update).not.toHaveBeenCalled()

    await release()
    expect(api.sleep.update).toHaveBeenCalledWith(
      { ...period, end: at(10, 8, 10) }
    )
    expect(row('2026-11-07').get('.caption').text())
      .toMatch(/^1:00\sAM to 10:00\sAM$/)

    // The release's click starts no selection.
    await track('2026-11-07').trigger('click')
    expect(timeline!.find('.-preview').exists())
      .toBe(false)
  })

  it('leaves it on a press without moving', async () => {
    storing([period])
    await mountTimeline()

    await move('2026-11-07', x(24 + 9, 20))
    await row('2026-11-07').get('.handle.-end')
      .trigger('pointerdown')
    await release()

    expect(window.bulletin.sleep.update)
      .not.toHaveBeenCalled()
    expect(row('2026-11-07').find('.hover').exists())
      .toBe(false)
  })

  it('moves the end as far as the pointer', async () => {
    storing([period])
    await mountTimeline()

    await move('2026-11-07', x(24 + 9, 20))
    await grab('2026-11-07', 'end',
      ['2026-11-07', x(24 + 9, 50)])
    await release()

    expect(window.bulletin.sleep.update)
      .toHaveBeenCalledWith(
        { ...period, end: at(10, 8, 9, 30) }
      )
  })

  it('shows a Tail on noon on its row', async () => {
    storing([period])
    await mountTimeline()

    await grab('2026-11-07', 'end',
      ['2026-11-07', x(36)])

    expect(hover('2026-11-07')).toMatch(/^12:00\sPM$/)
    expect(row('2026-11-08').find('.hover').exists())
      .toBe(false)
  })

  it('stops at a neighbouring Period', async () => {
    storing([
      period,
      { id: 2, start: at(10, 8, 11), end: at(10, 8, 12) }
    ])
    await mountTimeline()

    await grab('2026-11-07', 'end',
      ['2026-11-07', x(24 + 11, 30)])
    await release()

    expect(window.bulletin.sleep.update)
      .toHaveBeenCalledWith(
        { ...period, end: at(10, 8, 11) }
      )
  })

  it('moves the Head onto another row', async () => {
    const nap = {
      id: 1,
      start: at(10, 8, 13),
      end: at(10, 8, 15)
    }
    storing([nap])
    await mountTimeline()

    await grab('2026-11-08', 'start',
      ['2026-11-07', x(24 + 11)])
    expect(row('2026-11-07').get('.period').classes())
      .toContain('-head')
    await release()

    expect(window.bulletin.sleep.update)
      .toHaveBeenCalledWith(
        { ...nap, start: at(10, 8, 11) }
      )
    expect(row('2026-11-08').find('.caption').exists())
      .toBe(false)
  })

  it('puts it back on a storage error', async () => {
    storing([period])
    window.bulletin.sleep.update = vi.fn()
      .mockResolvedValue({
        ok: false,
        error: { code: 'overlapping-period' }
      })
    await mountTimeline()

    await grab('2026-11-07', 'start',
      ['2026-11-07', x(23)])
    await release()

    expect(timeline!.get('[role="alert"]').text()).toBe(
      "Couldn't move the period. "
      + 'It overlaps another period.'
    )
    expect(row('2026-11-07').get('.caption').text())
      .toMatch(/^1:00\sAM to 9:00\sAM$/)
  })
})

const tooltip = (): DOMWrapper<Element> =>
  timeline!.find('.sleep-period-editor')

/** Types into the tooltip's Start or End field. */
const type = (
  field: 'Start' | 'End',
  text: string
): Promise<void> =>
  tooltip().get(`[aria-label="${field}"]`).setValue(text)

const press = async (
  wrapper: Omit<DOMWrapper<Element>, 'exists'>,
  key: string
): Promise<void> => {
  await wrapper.trigger('keydown', { key })
  await settle()
}

describe('SleepTimeline, editing', () => {
  useFixedToday()
  beforeEach(() => {
    fakeLayout()
    fakeTrack()
  })

  afterEach(() => {
    timeline?.unmount()
    timeline = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  // 1 AM to 9 AM on the 8th, in row "7th".
  const period = {
    id: 1,
    start: at(10, 8, 1),
    end: at(10, 8, 9)
  }

  it('opens on a click and saves on Enter', async () => {
    storing([period])
    await mountTimeline()
    const api = window.bulletin

    await click('2026-11-07', x(24 + 5))
    expect(row('2026-11-07').get('.period').classes())
      .toContain('-editing')
    const start = tooltip().get('[aria-label="Start"]')
    expect((start.element as HTMLInputElement).value)
      .toMatch(/^1:00\sAM$/)
    expect(document.activeElement).toBe(start.element)

    await type('End', '9:47 AM')
    await press(start, 'Enter')

    expect(api.sleep.update).toHaveBeenCalledWith(
      { ...period, end: at(10, 8, 9, 47) }
    )
    expect(tooltip().exists()).toBe(false)
  })

  it('saves on a click away', async () => {
    storing([period])
    await mountTimeline()

    await click('2026-11-07', x(24 + 5))
    await type('Start', '23:30')
    document.body.click()
    await settle()

    expect(window.bulletin.sleep.update)
      .toHaveBeenCalledWith(
        { ...period, start: at(10, 7, 23, 30) }
      )
    expect(timeline!.find('.-preview').exists())
      .toBe(false)
  })

  it.each([
    ['an invalid time', '9:7x',
      /^Enter times like 2:15\sAM\.$/],
    ['a rule-breaking time', '11:30 AM',
      /^It overlaps another period\.$/]
  ])('refuses %s inline', async (_, end, error) => {
    storing([
      period,
      { id: 2, start: at(10, 8, 11), end: at(10, 8, 12) }
    ])
    await mountTimeline()

    await click('2026-11-07', x(24 + 5))
    await type('End', end)
    await press(tooltip().get('input'), 'Enter')
    document.body.click()
    await settle()

    expect(tooltip().get('[role="alert"]').text())
      .toMatch(error)
    expect(window.bulletin.sleep.update)
      .not.toHaveBeenCalled()
  })

  it('opens nothing on a press on a Tail', async () => {
    storing([period])
    await mountTimeline()

    await move('2026-11-07', x(24 + 9))
    await row('2026-11-07').get('.handle.-end')
      .trigger('pointerdown')
    await release()
    await track('2026-11-07').trigger('click',
      { clientX: x(24 + 9) })

    expect(tooltip().exists()).toBe(false)
  })

  it('keeps it on a storage error', async () => {
    storing([period])
    window.bulletin.sleep.update = vi.fn()
      .mockResolvedValue({
        ok: false,
        error: { code: 'internal' }
      })
    await mountTimeline()

    await click('2026-11-07', x(24 + 5))
    await type('End', '10:00')
    await press(tooltip().get('input'), 'Enter')

    expect(timeline!.get('[role="alert"]').text()).toBe(
      "Couldn't move the period. Something went wrong."
    )
    expect(row('2026-11-07').get('.caption').text())
      .toMatch(/^1:00\sAM to 9:00\sAM$/)
  })
  it('closes on Escape without saving', async () => {
    storing([period])
    await mountTimeline()

    await click('2026-11-07', x(24 + 5))
    await type('End', '10:00')
    await press(tooltip().get('input'), 'Escape')

    expect(tooltip().exists()).toBe(false)
    expect(window.bulletin.sleep.update)
      .not.toHaveBeenCalled()
  })
})
