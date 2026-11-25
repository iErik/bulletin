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
import {
  useSelectedDateStore
} from '@/stores/selected-date'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import HabitBoardWidget from './HabitBoardWidget.vue'

let wrapper: VueWrapper | undefined

const habit = (
  id: number,
  name: string,
  created: LocalDate = '2026-01-01',
  archivePeriods: ArchivePeriod[] = []
): Habit => ({
  id,
  name,
  icon: 'meditation',
  created,
  archived: archivePeriods.some(p => p.end === null),
  archivePeriods
})

const mountBoard = async (
  habits: Habit[] = [],
  entries: HabitEntry[] = [],
  goal = 75
): Promise<{
  wrapper: VueWrapper
  api: BulletinApi
  store: ReturnType<typeof useSelectedDateStore>
}> => {
  const api = stubBulletin()
  vi.mocked(api.habits.list)
    .mockResolvedValue({ ok: true, value: habits })
  vi.mocked(api.habits.listEntries)
    .mockResolvedValue({ ok: true, value: entries })
  vi.mocked(api.habits.getGoal)
    .mockResolvedValue({ ok: true, value: goal })
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(HabitBoardWidget, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper, api, store: useSelectedDateStore() }
}

describe('HabitBoardWidget', () => {
  // Today is 2026-11-09.
  useFixedToday()

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
  })

  it('renders header, ticks, rows, cell states, stats and Slipping',
    async () => {
      const medDays = eachDay({ from: '2026-11-01', to: '2026-11-09' })
      const slipPrev = eachDay({ from: '2026-10-13', to: '2026-10-26' })
      const { wrapper: w, api } = await mountBoard(
        [
          habit(3, 'Archived', '2026-01-01', [
            { start: '2026-11-05', end: null }
          ]),
          habit(2, 'Reading', '2026-01-01'),
          habit(1, 'Meditation', '2026-01-01'),
          habit(4, 'Restored', '2026-11-04', [
            { start: '2026-11-06', end: '2026-11-07' }
          ])
        ],
        [
          ...medDays.map(date => ({ habitId: 1, date })),
          ...slipPrev.map(date => ({ habitId: 2, date }))
        ],
        80
      )

      expect(api.habits.list).toHaveBeenCalledWith('all')
      expect(api.habits.listEntries).toHaveBeenCalledWith({
        from: '1970-01-01',
        to: '2026-11-09'
      })
      expect(w.get('.range').text()).toBe('Nov 1 – Nov 9')
      expect(w.findAll('.tick').map(t => t.text()))
        .toEqual(['Nov 1', 'Today'])
      expect(w.findAll('.tick')[1].classes()).toContain('-last')

      const rows = w.findAll('.row')
      expect(rows.map(r => r.get('.name').text()))
        .toEqual(['Meditation', 'Reading', 'Restored', 'Archived'])

      // Meditation: 9-day streak (glow + white highlight), 100% good.
      const medCells = rows[0].findAll('.cell')
      expect(medCells).toHaveLength(9)
      expect(medCells[8].classes())
        .toEqual(expect.arrayContaining(['-done', '-streak', '-selected']))
      expect(rows[0].findAll('.stat').map(s => s.text()))
        .toEqual(['9', '9', '100%'])
      expect(rows[0].findAll('.stat')[0].classes()).toContain('-high')
      expect(rows[0].findAll('.stat')[2].classes()).toContain('-good')

      // Reading: slipping, 0% low, Nov 9 dim + selected outline.
      expect(rows[1].find('.slipping').exists()).toBe(true)
      expect(rows[1].findAll('.cell')[8].classes())
        .toEqual(expect.arrayContaining(['-dim', '-selected']))
      expect(rows[1].findAll('.stat')[2].classes()).toContain('-low')

      // Restored: Nov 1-3 and Nov 6-7 blank.
      const restCells = rows[2].findAll('.cell')
      expect(restCells[0].classes()).toContain('-blank')
      expect(restCells[5].classes()).toContain('-blank')
      expect(restCells[3].classes()).toContain('-dim')

      // Archived: dimmed row. The Board is read-only.
      expect(rows[3].classes()).toContain('-archived')
      expect(w.findAll('button.cell')).toHaveLength(0)
    })

  it('shows an empty state without Habits', async () => {
    const { wrapper: w } = await mountBoard([])

    expect(w.get('.empty').text()).toBe('No habits yet')
    expect(w.find('.col-head').exists()).toBe(false)
  })

  it('handles day 1, 31-day dense mode, date changes and reloads',
    async () => {
      const { wrapper: w, api, store } = await mountBoard([
        habit(1, 'Meditation')
      ])

      // Day 1 of month -> "Nov 1" header and single cell.
      store.setDay(new Date(2026, 10, 1))
      await flushPromises()
      expect(w.get('.range').text()).toBe('Nov 1')
      expect(w.findAll('.cell')).toHaveLength(1)
      expect(w.findAll('.tick').map(t => t.text())).toEqual(['Nov 1'])

      // 31-day month (Oct 31) -> dense layout.
      store.setDay(new Date(2026, 9, 31))
      await flushPromises()
      expect(w.classes()).toContain('-dense')
      expect(w.findAll('.cell')).toHaveLength(31)

      // Reactive reloads on habit/entry/goal writes only.
      const calls = vi.mocked(api.habits.listEntries).mock.calls.length
      await api.habits.createEntry({ habitId: 1, date: '2026-10-31' })
      await api.habits.setGoal(85)
      await api.habits.create({ name: 'Walk', icon: 'walking' })
      await flushPromises()
      expect(api.habits.listEntries).toHaveBeenCalledTimes(calls + 3)

      await api.mood.create({ date: '2026-10-31', mood: 'happy' })
      await flushPromises()
      expect(api.habits.listEntries).toHaveBeenCalledTimes(calls + 3)
    })

  it('drops stale responses', async () => {
    const { wrapper: w, api, store } = await mountBoard([
      habit(2, 'Fresh')
    ])
    let resolve!: (v: { ok: true; value: Habit[] }) => void
    vi.mocked(api.habits.list).mockReturnValueOnce(
      new Promise(r => { resolve = r })
    )
    store.setDay(new Date(2026, 10, 8))
    await flushPromises()
    store.setDay(new Date(2026, 10, 7))
    await flushPromises()
    resolve({ ok: true, value: [habit(1, 'Stale')] })
    await flushPromises()

    expect(w.findAll('.row .name').map(n => n.text()))
      .toEqual(['Fresh'])
  })

  it('shows an alert when loading fails', async () => {
    const { wrapper: w, api, store } = await mountBoard()
    vi.mocked(api.habits.list).mockResolvedValue(
      { ok: false, error: { code: 'internal' } }
    )
    store.setDay(new Date(2026, 10, 8))
    await flushPromises()

    expect(w.get('[role="alert"]').text())
      .toBe('Couldn’t load the Habit Board.')
  })
})
