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

const cell = (
  w: VueWrapper,
  index: number
): ReturnType<VueWrapper['get']> =>
  w.findAll('button.cell')[index]

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

      // Meditation: 9-day streak (glow + white highlight),
      // 100% good, interactive button cells with labels.
      const medCells = rows[0].findAll('.cell')
      expect(medCells).toHaveLength(9)
      expect(medCells[8].element.tagName).toBe('BUTTON')
      expect(medCells[8].attributes('aria-pressed'))
        .toBe('true')
      expect(medCells[8].attributes('aria-label'))
        .toBe('Meditation · Nov 9 · Done')
      expect(medCells[8].classes()).toEqual(
        expect.arrayContaining([
          '-done', '-streak', '-selected'
        ])
      )
      expect(rows[0].findAll('.stat').map(s => s.text()))
        .toEqual(['9', '9', '100%'])
      expect(rows[0].findAll('.stat')[0].classes())
        .toContain('-high')
      expect(rows[0].findAll('.stat')[2].classes())
        .toContain('-good')

      // Reading: slipping, 0% low, Nov 9 dim + selected.
      expect(rows[1].find('.slipping').exists()).toBe(true)
      const readLast = rows[1].findAll('.cell')[8]
      expect(readLast.attributes('aria-pressed'))
        .toBe('false')
      expect(readLast.attributes('aria-label'))
        .toBe('Reading · Nov 9 · Not done')
      expect(readLast.classes()).toEqual(
        expect.arrayContaining(['-dim', '-selected'])
      )
      expect(rows[1].findAll('.stat')[2].classes())
        .toContain('-low')

      // Restored: Nov 1-3 and Nov 6-7 blank spans; Nov 4
      // counted interactive button.
      const restCells = rows[2].findAll('.cell')
      expect(restCells[0].element.tagName).toBe('SPAN')
      expect(restCells[0].classes()).toContain('-blank')
      expect(restCells[5].element.tagName).toBe('SPAN')
      expect(restCells[5].classes()).toContain('-blank')
      expect(restCells[3].element.tagName).toBe('BUTTON')
      expect(restCells[3].classes()).toContain('-dim')

      // Archived: dimmed row, read-only spans only.
      expect(rows[3].classes()).toContain('-archived')
      expect(rows[3].findAll('button.cell')).toHaveLength(0)
    })

  it('shows an empty state with + Add habit without Habits',
    async () => {
      const { wrapper: w } = await mountBoard([])

      expect(w.get('.empty').text()).toBe('No habits yet')
      expect(w.find('.col-head').exists()).toBe(false)
      expect(w.get('.add-button').text())
        .toContain('Add habit')
    })

  it('toggles cells empty to done and done to empty live',
    async () => {
      const prior = eachDay({
        from: '2026-10-13',
        to: '2026-10-26'
      })
      const recent = eachDay({
        from: '2026-10-27',
        to: '2026-11-06'
      })
      const seed = [...prior, ...recent].map(date => ({
        habitId: 1,
        date
      }))
      const { wrapper: w, api } = await mountBoard(
        [habit(1, 'Meditation')],
        seed
      )
      expect(w.find('.slipping').exists()).toBe(true)
      expect(w.findAll('.stat').map(s => s.text()))
        .toEqual(['0', '25', '67%'])

      // Tick Nov 9 -> done: streak 1, best 25, rate 78%,
      // and Slipping clears.
      const withToday = [
        ...seed,
        { habitId: 1, date: '2026-11-09' }
      ]
      vi.mocked(api.habits.listEntries).mockResolvedValue({
        ok: true,
        value: withToday
      })
      await cell(w, 8).trigger('click')
      expect(cell(w, 8).classes()).toContain('-done')
      expect(cell(w, 8).attributes('aria-pressed'))
        .toBe('true')
      expect(w.findAll('.stat').map(s => s.text()))
        .toEqual(['1', '25', '78%'])
      expect(w.find('.slipping').exists()).toBe(false)
      await flushPromises()
      expect(api.habits.createEntry).toHaveBeenCalledWith({
        habitId: 1,
        date: '2026-11-09'
      })

      // Untick Nov 9 -> dim: stats and Slipping revert.
      vi.mocked(api.habits.listEntries).mockResolvedValue({
        ok: true,
        value: seed
      })
      await cell(w, 8).trigger('click')
      expect(cell(w, 8).classes()).toContain('-dim')
      expect(cell(w, 8).attributes('aria-pressed'))
        .toBe('false')
      expect(w.findAll('.stat').map(s => s.text()))
        .toEqual(['0', '25', '67%'])
      expect(w.find('.slipping').exists()).toBe(true)
      await flushPromises()
      expect(api.habits.deleteEntry).toHaveBeenCalledWith({
        habitId: 1,
        date: '2026-11-09'
      })
    })

  it('reverts toggle and shows alert on storage failure',
    async () => {
      const { wrapper: w, api } = await mountBoard(
        [habit(1, 'Meditation')],
        [{ habitId: 1, date: '2026-11-09' }]
      )

      // Failed create reverts dim cell and shows alert.
      vi.mocked(api.habits.createEntry)
        .mockResolvedValueOnce({
          ok: false,
          error: { code: 'internal' }
        })
      await cell(w, 7).trigger('click')
      await flushPromises()
      expect(cell(w, 7).classes()).toContain('-dim')
      expect(w.get('[role="alert"]').text())
        .toBe('Couldn’t save that day. Try again.')

      // Failed delete reverts done cell and shows alert.
      vi.mocked(api.habits.deleteEntry)
        .mockResolvedValueOnce({
          ok: false,
          error: { code: 'internal' }
        })
      await cell(w, 8).trigger('click')
      await flushPromises()
      expect(cell(w, 8).classes()).toContain('-done')
      expect(w.get('[role="alert"]').text())
        .toBe('Couldn’t save that day. Try again.')
    })

  it('guards per-cell concurrent writes while saving',
    async () => {
      const { wrapper: w, api } = await mountBoard([
        habit(1, 'Meditation')
      ])
      let finishFirst!: (
        v: { ok: true; value: HabitEntry }
      ) => void
      let finishSecond!: (
        v: { ok: true; value: HabitEntry }
      ) => void
      vi.mocked(api.habits.createEntry)
        .mockReturnValueOnce(
          new Promise(r => { finishFirst = r })
        )
        .mockReturnValueOnce(
          new Promise(r => { finishSecond = r })
        )

      // Double-click Nov 9 while pending -> single call.
      await cell(w, 8).trigger('click')
      await cell(w, 8).trigger('click')
      expect(api.habits.createEntry)
        .toHaveBeenCalledTimes(1)
      expect(cell(w, 8).classes()).toContain('-done')

      // Different cell (Nov 8) writes independently and
      // survives the reload triggered by Nov 9 completing.
      await cell(w, 7).trigger('click')
      expect(api.habits.createEntry)
        .toHaveBeenCalledTimes(2)
      vi.mocked(api.habits.listEntries).mockResolvedValue({
        ok: true,
        value: [{ habitId: 1, date: '2026-11-09' }]
      })
      finishFirst({
        ok: true,
        value: { habitId: 1, date: '2026-11-09' }
      })
      await flushPromises()
      expect(cell(w, 7).classes()).toContain('-done')
      expect(cell(w, 8).classes()).toContain('-done')

      vi.mocked(api.habits.listEntries).mockResolvedValue({
        ok: true,
        value: [
          { habitId: 1, date: '2026-11-08' },
          { habitId: 1, date: '2026-11-09' }
        ]
      })
      finishSecond({
        ok: true,
        value: { habitId: 1, date: '2026-11-08' }
      })
      await flushPromises()
      expect(cell(w, 7).classes()).toContain('-done')
    })

  it('creates and restores Habits inline from + Add habit',
    async () => {
      const archived = habit(3, 'Journal', '2026-11-01', [
        { start: '2026-11-05', end: null }
      ])
      const { wrapper: w, api } = await mountBoard([
        archived
      ])
      expect(w.findAll('button.cell')).toHaveLength(0)

      // Create a new Habit.
      await w.get('.add-button').trigger('click')
      const created = habit(5, 'Running', '2026-11-09')
      vi.mocked(api.habits.create)
        .mockResolvedValueOnce({ ok: true, value: created })
      vi.mocked(api.habits.list).mockResolvedValue({
        ok: true,
        value: [archived, created]
      })
      await w.get('.habit-editor input').setValue('Running')
      await w.get('.habit-editor').trigger('submit')
      await flushPromises()

      expect(w.find('.habit-editor').exists()).toBe(false)
      expect(document.activeElement)
        .toBe(w.get('.add-button').element)
      expect(w.findAll('.row .name').map(n => n.text()))
        .toEqual(['Running', 'Journal'])

      // Restore the archived Habit.
      await w.get('.add-button').trigger('click')
      const restored = habit(3, 'Journal', '2026-11-01', [
        { start: '2026-11-05', end: '2026-11-08' }
      ])
      vi.mocked(api.habits.create).mockResolvedValueOnce({
        ok: true,
        value: restored
      })
      vi.mocked(api.habits.list).mockResolvedValue({
        ok: true,
        value: [restored, created]
      })
      await w.get('.habit-editor input').setValue('Journal')
      await w.get('.habit-editor').trigger('submit')
      await flushPromises()

      expect(w.find('.habit-editor').exists()).toBe(false)
      expect(w.findAll('.row.-archived')).toHaveLength(0)
      expect(w.findAll('.row')[0].findAll('button.cell'))
        .toHaveLength(5)
    })

  it('cancels HabitEditor via Cancel button and Escape',
    async () => {
      const { wrapper: w, api } = await mountBoard([])

      await w.get('.add-button').trigger('click')
      await w.get('.habit-editor input').setValue('Walk')
      await w.get('button[aria-label="Cancel"]')
        .trigger('click')
      await flushPromises()
      expect(w.find('.habit-editor').exists()).toBe(false)
      expect(api.habits.create).not.toHaveBeenCalled()
      expect(document.activeElement)
        .toBe(w.get('.add-button').element)

      await w.get('.add-button').trigger('click')
      await w.get('.habit-editor input')
        .trigger('keydown', { key: 'Escape' })
      await flushPromises()
      expect(w.find('.habit-editor').exists()).toBe(false)
      expect(api.habits.create).not.toHaveBeenCalled()
      expect(document.activeElement)
        .toBe(w.get('.add-button').element)
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
