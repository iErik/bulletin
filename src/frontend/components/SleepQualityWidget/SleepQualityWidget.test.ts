import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BulletinApi } from '@shared/bridge'
import type {
  SleepQualityEntry,
  SleepQualityRating
} from '@shared/sleep-quality'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import SleepQualityWidget from './SleepQualityWidget.vue'

let widget: VueWrapper | undefined

const ENTRIES: SleepQualityEntry[] = [
  { date: '2026-11-03', rating: 2 },
  { date: '2026-11-05', rating: 5 },
  { date: '2026-11-08', rating: 4 }
]

/**
 * Mounts it on November, with `sleepQuality` backed by
 * an in-memory store holding `initial`.
 */
const mountWidget = async (
  initial: SleepQualityEntry[] = ENTRIES
): Promise<{ wrapper: VueWrapper; api: BulletinApi }> => {
  const stored = new Map<string, SleepQualityRating>(
    initial.map(entry => [entry.date, entry.rating])
  )
  const api = stubBulletin()
  const quality = vi.mocked(api.sleepQuality)
  quality.list.mockImplementation(async range => ({
    ok: true,
    value: [...stored]
      .filter(([date]) =>
        date >= range.from && date <= range.to)
      .map(([date, rating]) => ({ date, rating }))
  }))
  quality.create.mockImplementation(async entry => {
    stored.set(entry.date, entry.rating)
    return { ok: true, value: entry }
  })
  quality.delete.mockImplementation(async date => {
    stored.delete(date)
    return { ok: true, value: null }
  })
  const pinia = createPinia()
  setActivePinia(pinia)
  widget = mount(SleepQualityWidget, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper: widget, api }
}

const pill = (
  wrapper: VueWrapper,
  day: number
): DOMWrapper<HTMLButtonElement> =>
  wrapper.findAll<HTMLButtonElement>('.pill')[day - 1]

const label = (wrapper: VueWrapper, day: number): string =>
  pill(wrapper, day).attributes('aria-label') ?? ''

const button = (
  wrapper: VueWrapper,
  name: string
): DOMWrapper<HTMLButtonElement> =>
  wrapper.find<HTMLButtonElement>(
    `button[aria-label="${name}"]`
  )

const step = (
  wrapper: VueWrapper,
  name: string
): DOMWrapper<HTMLButtonElement> =>
  wrapper.findAll<HTMLButtonElement>('[role="radio"]')
    .find(option => option.text() === name)!

const isOpen = (wrapper: VueWrapper): boolean =>
  wrapper.find('.sleep-quality-picker').exists()

const escape = async (wrapper: VueWrapper): Promise<void> => {
  await wrapper.get('[role="radio"]')
    .trigger('keydown', { key: 'Escape' })
  await flushPromises()
}

const average = (wrapper: VueWrapper): string =>
  wrapper.get('.average').text()

// Today is November 9th, 2026. Months are 0-based.
describe('SleepQualityWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('loads the month, with the legend', async () => {
    const { wrapper, api } = await mountWidget()

    expect(api.sleepQuality.list).toHaveBeenCalledWith({
      from: '2026-11-01',
      to: '2026-11-30'
    })
    expect(wrapper.get('.title').text()).toBe('Quality')
    expect(average(wrapper)).toBe('Avg 3.7')
    expect(wrapper.findAll('.footer .bound')
      .map(bound => bound.text())).toEqual(['Poor', 'Great'])
    expect(wrapper.get('.caption').text())
      .toBe('Rated after waking')
    expect(wrapper.findAll('.swatch')
      .map(swatch => swatch.attributes('style')))
      .toEqual(['0.18', '0.35', '0.55', '0.78', '1']
        .map(value => `--pill-opacity: ${value};`))
  })

  it('paints rated Day Pills on the white ramp',
    async () => {
      const { wrapper } = await mountWidget()

      const fair = pill(wrapper, 3)
      expect(fair.classes()).toContain('-filled')
      expect(fair.attributes('style'))
        .toContain('var(--color-pill-quality-base)')
      expect(fair.attributes('style'))
        .toContain('--pill-opacity: 0.35')
      expect(pill(wrapper, 5).attributes('style'))
        .toContain('--pill-opacity: 1')
      expect(pill(wrapper, 4).classes())
        .not.toContain('-filled')
      expect(label(wrapper, 3)).toBe('Nov 3 · Fair')
      expect(label(wrapper, 4)).toBe('Nov 4 · Not rated')
    })

  it('hides the average in the empty state', async () => {
    const { wrapper } = await mountWidget([])

    expect(wrapper.find('.average').exists()).toBe(false)
    expect(wrapper.findAll('.pill.-filled')).toHaveLength(0)
  })

  it('hides and blocks days after the Selected Date',
    async () => {
      const { wrapper, api } = await mountWidget()
      await pill(wrapper, 8).trigger('click')
      useSelectedDateStore().setDay(new Date(2026, 10, 5))
      await flushPromises()

      expect(isOpen(wrapper)).toBe(false)
      // Same month: no reload, and Nov 8's 4 is left out.
      expect(api.sleepQuality.list).toHaveBeenCalledTimes(1)
      expect(average(wrapper)).toBe('Avg 3.5')
      expect(pill(wrapper, 8).classes())
        .toEqual(['pill', '-disabled'])
      expect(label(wrapper, 8)).toBe('Nov 8 · Not rated')

      await pill(wrapper, 8).trigger('click')
      await pill(wrapper, 20).trigger('click')
      expect(isOpen(wrapper)).toBe(false)
    })

  it('opens the picker by click or keyboard', async () => {
    const { wrapper } = await mountWidget()

    await pill(wrapper, 3).trigger('click')
    expect(wrapper.get('.title').text())
      .toBe('Quality · November 3rd, 2026')
    expect(wrapper.get('[aria-checked="true"]').text())
      .toBe('Fair')
    expect(wrapper.find('.month-grid').exists()).toBe(false)

    await escape(wrapper)
    for (const key of ['Enter', ' ']) {
      await pill(wrapper, 4).trigger('keydown', { key })
      expect(isOpen(wrapper)).toBe(true)
      await escape(wrapper)
    }
  })

  it('closes on Escape or outside click, restoring focus',
    async () => {
      const { wrapper, api } = await mountWidget()
      await pill(wrapper, 3).trigger('click')
      await step(wrapper, 'Great').trigger('click')
      await escape(wrapper)

      expect(isOpen(wrapper)).toBe(false)
      expect(document.activeElement)
        .toBe(pill(wrapper, 3).element)

      await pill(wrapper, 5).trigger('click')
      await step(wrapper, 'Poor').trigger('click')
      document.body.click()
      await flushPromises()

      expect(isOpen(wrapper)).toBe(false)
      expect(document.activeElement)
        .toBe(pill(wrapper, 5).element)
      expect(api.sleepQuality.create).not.toHaveBeenCalled()
    })

  it('stays open on inside clicks and while writing',
    async () => {
      const { wrapper, api } = await mountWidget()
      await pill(wrapper, 3).trigger('click')
      wrapper.get('.label').element.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      )
      await flushPromises()
      expect(isOpen(wrapper)).toBe(true)

      vi.mocked(api.sleepQuality.delete)
        .mockReturnValue(new Promise(() => {}))
      await button(wrapper, 'Clear quality').trigger('click')
      document.body.click()
      await flushPromises()
      expect(isOpen(wrapper)).toBe(true)
    })

  it('saves Great and clears a rating', async () => {
    const { wrapper, api } = await mountWidget()
    await pill(wrapper, 4).trigger('click')
    await step(wrapper, 'Great').trigger('click')
    await button(wrapper, 'Save quality').trigger('click')
    await flushPromises()

    expect(isOpen(wrapper)).toBe(false)
    expect(api.sleepQuality.create).toHaveBeenCalledWith({
      date: '2026-11-04',
      rating: 5
    })
    expect(pill(wrapper, 4).attributes('style'))
      .toContain('--pill-opacity: 1')
    expect(label(wrapper, 4)).toBe('Nov 4 · Great')
    expect(average(wrapper)).toBe('Avg 4.0')
    expect(document.activeElement)
      .toBe(pill(wrapper, 4).element)

    await pill(wrapper, 3).trigger('click')
    await button(wrapper, 'Clear quality').trigger('click')
    await flushPromises()

    expect(api.sleepQuality.delete)
      .toHaveBeenCalledWith('2026-11-03')
    expect(pill(wrapper, 3).classes())
      .not.toContain('-filled')
    expect(average(wrapper)).toBe('Avg 4.7')
  })

  it('shows another month, closing the picker',
    async () => {
      const { wrapper, api } = await mountWidget([
        ...ENTRIES,
        { date: '2026-10-31', rating: 3 }
      ])
      await pill(wrapper, 3).trigger('click')

      useSelectedDateStore().setDay(new Date(2026, 9, 31))
      await flushPromises()

      expect(isOpen(wrapper)).toBe(false)
      expect(api.sleepQuality.list).toHaveBeenLastCalledWith({
        from: '2026-10-01',
        to: '2026-10-31'
      })
      expect(label(wrapper, 31)).toBe('Oct 31 · Okay')
      expect(average(wrapper)).toBe('Avg 3.0')
    })

  it('drops a load another one overtook', async () => {
    const { wrapper, api } = await mountWidget()
    const store = useSelectedDateStore()
    let resolveOctober = (): void => {}
    vi.mocked(api.sleepQuality.list).mockReturnValueOnce(
      new Promise(resolve => {
        resolveOctober = () => resolve({
          ok: true,
          value: [{ date: '2026-11-04', rating: 5 }]
        })
      })
    )

    store.setDay(new Date(2026, 9, 15))
    await flushPromises()
    store.setDay(new Date(2026, 10, 1))
    await flushPromises()
    resolveOctober()
    await flushPromises()

    expect(label(wrapper, 4)).toBe('Nov 4 · Not rated')
  })

  it('reloads on sleepQuality writes only', async () => {
    const { wrapper, api } = await mountWidget()
    const list = vi.mocked(api.sleepQuality.list)

    await api.mood.create({ date: '2026-11-09', mood: 'happy' })
    await flushPromises()
    expect(list).toHaveBeenCalledTimes(1)

    await api.sleepQuality.create({
      date: '2026-11-09',
      rating: 1
    })
    await flushPromises()
    expect(list).toHaveBeenCalledTimes(2)
    expect(label(wrapper, 9)).toBe('Nov 9 · Poor')
    expect(average(wrapper)).toBe('Avg 3.0')
  })

  it('says when Sleep Quality can’t load', async () => {
    const api = stubBulletin()
    vi.mocked(api.sleepQuality.list).mockResolvedValue({
      ok: false,
      error: { code: 'internal' }
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    widget = mount(SleepQualityWidget, {
      attachTo: document.body,
      global: { plugins: [pinia] }
    })
    await flushPromises()

    expect(widget.get('[role="alert"]').text())
      .toBe('Couldn’t load Sleep Quality.')
    expect(widget.find('.average').exists()).toBe(false)
  })
})
