import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import {
  flushPromises,
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BulletinApi } from '@shared/bridge'
import type { MoodEntry } from '@shared/mood'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import MoodView from './MoodView.vue'

let view: VueWrapper | undefined

const mountView = async (
  entries: MoodEntry[] = []
): Promise<{
  view: VueWrapper
  api: BulletinApi
  store: ReturnType<typeof useSelectedDateStore>
}> => {
  const api = stubBulletin()
  vi.mocked(api.mood.list)
    .mockResolvedValue({ ok: true, value: entries })
  const pinia = createPinia()
  setActivePinia(pinia)
  const bar = document.createElement('div')
  bar.id = 'title-bar-content'
  document.body.append(bar)
  view = mount(MoodView, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { view, api, store: useSelectedDateStore() }
}

const pill = (
  wrapper: VueWrapper,
  day: number
): DOMWrapper<HTMLButtonElement> =>
  wrapper.findAll<HTMLButtonElement>('.pill')[day - 1]

describe('MoodView', () => {
  useFixedToday()

  afterEach(() => {
    view?.unmount()
    view = undefined
    document.body.innerHTML = ''
  })

  it('shows the Mood Widget in the bottom-left cell',
    async () => {
      const { view: page } = await mountView()

      expect(
        page.find(
          '.left > .mood-widget > .mood-grid-frame'
          + ' .month-grid'
        ).exists()
      ).toBe(true)
      for (const cell of [
        'wide',
        'side',
        'middle',
        'right'
      ]) {
        expect(page.get(`.${cell}`).element.children)
          .toHaveLength(0)
      }
    })

  it('puts the date header in the Title Bar', async () => {
    await mountView()

    expect(
      document.querySelector(
        '#title-bar-content > .date-header'
      )
    ).not.toBeNull()
  })

  it('opens the Mood picker from a Day Pill and saves',
    async () => {
      const { view: page, api } = await mountView()

      await pill(page, 4).trigger('click')
      expect(page.find('.mood-picker').exists()).toBe(true)

      const stressed = page
        .findAll<HTMLButtonElement>('[role="radio"]')
        .find(option => option.text() === 'Stressed')!
      await stressed.trigger('click')
      await page.get('button[aria-label="Save mood"]')
        .trigger('click')
      await flushPromises()

      expect(api.mood.create).toHaveBeenCalledWith({
        date: '2026-11-04',
        mood: 'stressed'
      })
      expect(pill(page, 4).attributes('aria-label'))
        .toBe('Nov 4 · Stressed')
    })

  it('follows the Selected Date and reloads another month',
    async () => {
      const { view: page, api, store } = await mountView()

      expect(pill(page, 9).classes()).toContain('-selected')

      store.step(-1)
      await flushPromises()
      expect(pill(page, 8).classes()).toContain('-selected')
      expect(api.mood.list).toHaveBeenCalledTimes(1)

      vi.mocked(api.mood.list).mockResolvedValue({
        ok: true,
        value: [{ date: '2026-10-15', mood: 'okay' }]
      })
      store.setDay(new Date(2026, 9, 15))
      await flushPromises()

      expect(api.mood.list).toHaveBeenLastCalledWith({
        from: '2026-10-01',
        to: '2026-10-31'
      })
      expect(pill(page, 15).classes())
        .toContain('-selected')
      expect(pill(page, 15).attributes('aria-label'))
        .toBe('Oct 15 · Okay')
    })
})
