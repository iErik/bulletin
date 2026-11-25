import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BulletinApi } from '@shared/bridge'
import type {
  ArchivePeriod,
  Habit,
  HabitEntry
} from '@shared/habits'
import type { LocalDate } from '@shared/storage'
import { eachDay } from '@/habits/rules'
import { setLocaleOverride } from '@/locale/format'
import {
  useSelectedDateStore
} from '@/stores/selected-date'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import HabitsByWeekdayWidget from './HabitsByWeekdayWidget.vue'

let wrapper: VueWrapper | undefined

const habit = (
  id: number,
  name: string,
  created: LocalDate = '2025-01-01',
  archivePeriods: ArchivePeriod[] = []
): Habit => ({
  id, name, icon: 'exercise', created,
  archived: archivePeriods.some(p => p.end === null),
  archivePeriods
})

const mountWidget = async (
  habits: Habit[] = [],
  entries: HabitEntry[] = []
): Promise<{
  wrapper: VueWrapper
  api: BulletinApi
  store: ReturnType<typeof useSelectedDateStore>
}> => {
  const api = stubBulletin()
  vi.mocked(api.habits.list).mockResolvedValue({ ok: true, value: habits })
  vi.mocked(api.habits.listEntries)
    .mockResolvedValue({ ok: true, value: entries })
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(HabitsByWeekdayWidget, {
    attachTo: document.body, global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper, api, store: useSelectedDateStore() }
}

describe('HabitsByWeekdayWidget', () => {
  useFixedToday()
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
  })

  it('renders 84-day grid, highlights weekday, marks < 35% & tooltip',
    async () => {
      const fridays = eachDay({ from: '2026-08-18', to: '2026-11-09' })
        .filter(d => new Date(`${d}T00:00`).getDay() === 5)
      const { wrapper: w, api } = await mountWidget(
        [
          habit(3, 'Reading', '2025-01-01', [
            { start: '2026-10-01', end: null }
          ]),
          habit(1, 'Journal', '2026-11-08'),
          habit(2, 'Exercise', '2025-01-01')
        ],
        fridays.slice(0, 3).map(date => ({ habitId: 2, date }))
      )

      expect(api.habits.list).toHaveBeenCalledWith('all')
      expect(api.habits.listEntries)
        .toHaveBeenCalledWith({ from: '2026-08-18', to: '2026-11-09' })
      expect(w.findAll('.row > .name').map(n => n.text()))
        .toEqual(['Exercise', 'Journal', 'Reading'])
      expect(w.findAll('.weekdays > .day').map(d => d.text()))
        .toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S'])
      expect(w.findAll('.weekdays > .day')[1].classes()).toContain('-active')

      const exFri = w.findAll('.row')[0].findAll('.cell')[5]
      expect(exFri.attributes('aria-label')).toBe('Exercise · Fri · 25%')
      expect(exFri.classes()).toContain('-low')
      expect(w.findAll('.row')[1].findAll('.cell')[2].classes())
        .toContain('-blank')
      expect(w.get('.footnote').text())
        .toBe('Red outline: done under 35% of the time')

      await exFri.trigger('pointerenter')
      expect(w.get('.tooltip').text()).toBe('Exercise · Fri · 25%')
      await exFri.trigger('click')
      expect(api.habits.createEntry).not.toHaveBeenCalled()
      await exFri.trigger('pointerleave')
      expect(w.find('.tooltip').exists()).toBe(false)
      await exFri.trigger('focus')
      expect(w.get('.tooltip').text()).toBe('Exercise · Fri · 25%')
      await exFri.trigger('keydown', { key: 'Escape' })
      expect(w.find('.tooltip').exists()).toBe(false)
    })

  it('follows Monday-first Locales and reloads on Habit writes only',
    async () => {
      setLocaleOverride('en-GB')
      const { wrapper: w, api, store } = await mountWidget([
        habit(1, 'Meditation')
      ])
      expect(w.findAll('.weekdays > .day').map(d => d.text()))
        .toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
      expect(w.findAll('.weekdays > .day')[0].classes()).toContain('-active')

      store.setDay(new Date(2026, 9, 15))
      await flushPromises()
      expect(api.habits.listEntries)
        .toHaveBeenLastCalledWith({ from: '2026-07-24', to: '2026-10-15' })
      const calls = vi.mocked(api.habits.listEntries).mock.calls.length
      await api.habits.createEntry({ habitId: 1, date: '2026-10-15' })
      await api.habits.create({ name: 'Walk', icon: 'walking' })
      await flushPromises()
      expect(api.habits.listEntries).toHaveBeenCalledTimes(calls + 2)
      await api.mood.create({ date: '2026-10-15', mood: 'happy' })
      await flushPromises()
      expect(api.habits.listEntries).toHaveBeenCalledTimes(calls + 2)
    })

  it('drops stale responses, and renders empty and error states',
    async () => {
      let resolveFirst!: (v: { ok: true; value: Habit[] }) => void
      const first = new Promise<{ ok: true; value: Habit[] }>(
        r => { resolveFirst = r }
      )
      const api = stubBulletin()
      vi.mocked(api.habits.list).mockReturnValueOnce(first)
        .mockResolvedValueOnce({ ok: true, value: [habit(2, 'Fresh')] })
      const pinia = createPinia()
      setActivePinia(pinia)
      wrapper = mount(HabitsByWeekdayWidget, { global: { plugins: [pinia] } })
      useSelectedDateStore().setDay(new Date(2026, 10, 8))
      await flushPromises()
      resolveFirst({ ok: true, value: [habit(1, 'Stale')] })
      await flushPromises()
      expect(wrapper.findAll('.row > .name').map(n => n.text()))
        .toEqual(['Fresh'])
      wrapper.unmount()

      const { wrapper: empty } = await mountWidget([])
      expect(empty.get('.message').text())
        .toBe('No habits in the last 12 weeks')
      expect(empty.find('.weekdays').exists()).toBe(false)
      expect(empty.find('.footnote').exists()).toBe(false)
      empty.unmount()

      vi.mocked(stubBulletin().habits.list)
        .mockResolvedValue({ ok: false, error: { code: 'internal' } })
      wrapper = mount(HabitsByWeekdayWidget, {
        global: { plugins: [createPinia()] }
      })
      await flushPromises()
      expect(wrapper.get('[role="alert"]').text())
        .toBe('Couldn’t load By Weekday.')
      expect(wrapper.find('.weekdays').exists()).toBe(false)
    })
})
