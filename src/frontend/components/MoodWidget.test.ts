import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { MoodEntry } from '@shared/mood'
import type { BulletinApi } from '@shared/bridge'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import MoodWidget from './MoodWidget.vue'

let widget: VueWrapper | undefined

const ENTRIES: MoodEntry[] = [
  { date: '2026-11-03', mood: 'happy' },
  { date: '2026-11-05', mood: 'angry' }
]

/** Mounts it on November with ENTRIES stored. */
const mountWidget = async (
  entries: MoodEntry[] = ENTRIES
): Promise<{ wrapper: VueWrapper; api: BulletinApi }> => {
  const api = stubBulletin()
  vi.mocked(api.mood.list)
    .mockResolvedValue({ ok: true, value: entries })
  const pinia = createPinia()
  setActivePinia(pinia)
  widget = mount(MoodWidget, {
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

const button = (
  wrapper: VueWrapper,
  name: string
): DOMWrapper<HTMLButtonElement> =>
  wrapper.find<HTMLButtonElement>(
    `button[aria-label="${name}"]`
  )

const mood = (
  wrapper: VueWrapper,
  label: string
): DOMWrapper<HTMLButtonElement> =>
  wrapper.findAll<HTMLButtonElement>('[role="radio"]')
    .find(option => option.text() === label)!

const isOpen = (wrapper: VueWrapper): boolean =>
  wrapper.find('.mood-picker').exists()

const clickOutside = async (): Promise<void> => {
  document.body.click()
  await flushPromises()
}

// Today is November 9th, 2026. Months are 0-based.
describe('MoodWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('loads the Selected Date’s month', async () => {
    const { api } = await mountWidget()

    expect(api.mood.list).toHaveBeenCalledWith({
      from: '2026-11-01',
      to: '2026-11-30'
    })
  })

  it('paints Day Pills with their Mood', async () => {
    const { wrapper } = await mountWidget()

    expect(pill(wrapper, 3).classes()).toContain('-filled')
    expect(pill(wrapper, 3).attributes('style'))
      .toContain('var(--color-mood-happy)')
    expect(pill(wrapper, 5).attributes('style'))
      .toContain('var(--color-mood-angry)')
    expect(pill(wrapper, 4).classes())
      .not.toContain('-filled')
  })

  it('labels Day Pills with their Mood', async () => {
    const { wrapper } = await mountWidget()

    expect(pill(wrapper, 3).attributes('aria-label'))
      .toBe('Nov 3 · Happy')
    expect(pill(wrapper, 4).attributes('aria-label'))
      .toBe('Nov 4 · No mood')
  })

  it('opens the picker on a Day Pill', async () => {
    const { wrapper } = await mountWidget()

    await pill(wrapper, 3).trigger('click')

    expect(wrapper.get('.title').text())
      .toBe('Mood · November 3rd, 2026')
    expect(wrapper.get('[aria-checked="true"]').text())
      .toBe('Happy')
    expect(wrapper.find('.month-grid').exists())
      .toBe(false)
  })

  it.each(['Enter', ' '])(
    'opens the picker with %j',
    async key => {
      const { wrapper } = await mountWidget()

      await pill(wrapper, 4).trigger('keydown', { key })

      expect(isOpen(wrapper)).toBe(true)
    }
  )

  it('doesn’t open on a future day', async () => {
    const { wrapper } = await mountWidget()

    await pill(wrapper, 20).trigger('click')

    expect(isOpen(wrapper)).toBe(false)
  })

  it('closes on Escape, focusing the Day Pill',
    async () => {
      const { wrapper, api } = await mountWidget()
      await pill(wrapper, 3).trigger('click')

      await mood(wrapper, 'Okay').trigger('click')
      await mood(wrapper, 'Okay')
        .trigger('keydown', { key: 'Escape' })
      await flushPromises()

      expect(isOpen(wrapper)).toBe(false)
      expect(api.mood.create).not.toHaveBeenCalled()
      expect(document.activeElement)
        .toBe(pill(wrapper, 3).element)
    })

  it('closes on a click outside, focusing the Day Pill',
    async () => {
      const { wrapper, api } = await mountWidget()
      await pill(wrapper, 5).trigger('click')
      await mood(wrapper, 'Okay').trigger('click')

      await clickOutside()

      expect(isOpen(wrapper)).toBe(false)
      expect(api.mood.create).not.toHaveBeenCalled()
      expect(document.activeElement)
        .toBe(pill(wrapper, 5).element)
    })

  it('stays open on a click inside', async () => {
    const { wrapper } = await mountWidget()
    await pill(wrapper, 3).trigger('click')

    await mood(wrapper, 'Okay').trigger('click')
    wrapper.get('.label').element
      .dispatchEvent(new MouseEvent('click', {
        bubbles: true
      }))
    await flushPromises()

    expect(isOpen(wrapper)).toBe(true)
  })

  it('stays open on a click outside while writing',
    async () => {
      const { wrapper, api } = await mountWidget()
      vi.mocked(api.mood.delete)
        .mockReturnValue(new Promise(() => {}))
      await pill(wrapper, 3).trigger('click')

      await button(wrapper, 'Clear mood').trigger('click')
      await clickOutside()

      expect(isOpen(wrapper)).toBe(true)
    })

  it('shows a saved Mood in place', async () => {
    const { wrapper, api } = await mountWidget()
    await pill(wrapper, 4).trigger('click')

    await mood(wrapper, 'Stressed').trigger('click')
    await button(wrapper, 'Save mood').trigger('click')
    await flushPromises()

    expect(isOpen(wrapper)).toBe(false)
    expect(api.mood.list).toHaveBeenCalledTimes(1)
    expect(pill(wrapper, 4).attributes('aria-label'))
      .toBe('Nov 4 · Stressed')
    expect(pill(wrapper, 4).attributes('style'))
      .toContain('var(--color-mood-stressed)')
    expect(document.activeElement)
      .toBe(pill(wrapper, 4).element)
  })

  it('shows a cleared Mood in place', async () => {
    const { wrapper, api } = await mountWidget()
    await pill(wrapper, 3).trigger('click')

    await button(wrapper, 'Clear mood').trigger('click')
    await flushPromises()

    expect(api.mood.list).toHaveBeenCalledTimes(1)
    expect(pill(wrapper, 3).attributes('aria-label'))
      .toBe('Nov 3 · No mood')
    expect(pill(wrapper, 3).classes())
      .not.toContain('-filled')
  })

  it('reloads when the Selected Date’s month changes',
    async () => {
      const { wrapper, api } = await mountWidget()
      const store = useSelectedDateStore()

      store.setDay(new Date(2026, 10, 2))
      await flushPromises()
      expect(api.mood.list).toHaveBeenCalledTimes(1)

      vi.mocked(api.mood.list).mockResolvedValue({
        ok: true,
        value: [{ date: '2026-10-31', mood: 'okay' }]
      })
      store.setDay(new Date(2026, 9, 15))
      await flushPromises()

      expect(api.mood.list).toHaveBeenLastCalledWith({
        from: '2026-10-01',
        to: '2026-10-31'
      })
      expect(pill(wrapper, 31).attributes('aria-label'))
        .toBe('Oct 31 · Okay')
    })

  it('closes the picker on another month', async () => {
    const { wrapper } = await mountWidget()
    await pill(wrapper, 3).trigger('click')

    useSelectedDateStore().setDay(new Date(2026, 9, 15))
    await flushPromises()

    expect(isOpen(wrapper)).toBe(false)
  })

  it('drops a load another one overtook', async () => {
    const { wrapper, api } = await mountWidget()
    const store = useSelectedDateStore()
    let resolveOctober = (): void => {}
    vi.mocked(api.mood.list)
      .mockReturnValueOnce(new Promise(resolve => {
        resolveOctober = () => resolve({
          ok: true,
          value: [{ date: '2026-11-04', mood: 'okay' }]
        })
      }))

    store.setDay(new Date(2026, 9, 15))
    await flushPromises()
    store.setDay(new Date(2026, 10, 1))
    await flushPromises()
    resolveOctober()
    await flushPromises()

    expect(pill(wrapper, 4).attributes('aria-label'))
      .toBe('Nov 4 · No mood')
  })

  it('says when the Moods can’t load', async () => {
    const api = stubBulletin()
    vi.mocked(api.mood.list).mockResolvedValue({
      ok: false,
      error: { code: 'internal' }
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    widget = mount(MoodWidget, {
      attachTo: document.body,
      global: { plugins: [pinia] }
    })
    await flushPromises()

    expect(widget.get('[role="alert"]').text())
      .toBe('Couldn’t load the Moods.')
  })
})
