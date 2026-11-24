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
import type { Habit, HabitEntry } from '@shared/habits'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import HabitsView from './HabitsView.vue'

let view: VueWrapper | undefined

const READING: Habit = {
  id: 1,
  name: 'Reading',
  icon: 'reading',
  created: '2026-01-01',
  archived: false,
  archivePeriods: []
}

const mountView = async (
  entries: HabitEntry[] = []
): Promise<{
  view: VueWrapper
  api: BulletinApi
  store: ReturnType<typeof useSelectedDateStore>
}> => {
  const api = stubBulletin()
  vi.mocked(api.habits.list)
    .mockResolvedValue({ ok: true, value: [READING] })
  vi.mocked(api.habits.listEntries)
    .mockResolvedValue({ ok: true, value: entries })
  const pinia = createPinia()
  setActivePinia(pinia)
  const bar = document.createElement('div')
  bar.id = 'title-bar-content'
  document.body.append(bar)
  view = mount(HabitsView, {
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

describe('HabitsView', () => {
  useFixedToday()

  afterEach(() => {
    view?.unmount()
    view = undefined
    document.body.innerHTML = ''
  })

  it('shows the Habits Widget in the bottom-left cell',
    async () => {
      const { view: page } = await mountView()

      expect(
        page.find('.page-grid > .left > .habits-widget')
          .exists()
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

  it('ticks a day as on the Dashboard', async () => {
    const { view: page, api } = await mountView()

    await pill(page, 4).trigger('click')
    await flushPromises()

    expect(api.habits.createEntry).toHaveBeenCalledWith({
      habitId: 1,
      date: '2026-11-04'
    })
    expect(pill(page, 4).attributes('aria-label'))
      .toBe('Nov 4 · Done')
  })

  it('follows the Selected Date to another month',
    async () => {
      const { view: page, api, store } = await mountView()

      vi.mocked(api.habits.listEntries).mockResolvedValue({
        ok: true,
        value: [{ habitId: 1, date: '2026-10-15' }]
      })
      store.setDay(new Date(2026, 9, 15))
      await flushPromises()

      expect(api.habits.listEntries).toHaveBeenLastCalledWith({
        from: '2026-10-01',
        to: '2026-10-31'
      })
      expect(pill(page, 15).attributes('aria-label'))
        .toBe('Oct 15 · Done')
    })
})
