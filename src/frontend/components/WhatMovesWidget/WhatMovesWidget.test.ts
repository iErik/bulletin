import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import {
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BulletinApi } from '@shared/bridge'
import type { Budget, Transaction } from '@shared/expenses'
import type { Habit, HabitEntry } from '@shared/habits'
import type { MoodEntry, MoodKey } from '@shared/mood'
import type { SleepPeriod } from '@shared/sleep'
import type {
  EffectTone,
  MoodEffect
} from '@/mood/mood-effect'
import {
  calendarRow,
  expensesRow,
  habitsRow,
  sleepRow,
  type MoodRow
} from '@/mood/what-moves'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import WhatMovesWidget from './WhatMovesWidget.vue'

vi.mock('@/mood/what-moves', () => ({
  sleepRow: vi.fn(),
  habitsRow: vi.fn(),
  expensesRow: vi.fn(),
  calendarRow: vi.fn()
}))

let wrapper: VueWrapper | undefined

const MEDITATION: Habit = {
  id: 4,
  name: 'Meditation',
  icon: 'meditation',
  created: '2026-01-01',
  archived: false,
  archivePeriods: []
}
const MOODS: MoodEntry[] = [{ date: '2026-11-08', mood: 'happy' }]
const PERIODS: SleepPeriod[] = [{ id: 1, start: 0, end: 1 }]
const ENTRIES: HabitEntry[] = [{ habitId: 4, date: '2026-11-08' }]
const TRANSACTIONS = [{ id: 9 }] as unknown as Transaction[]
const budget = (month: string): Budget =>
  ({ month, amount: 100_000 })

const row = (
  mood: MoodKey,
  tone: EffectTone,
  value: string
): MoodRow => ({
  effect: { mood, tone } as MoodEffect,
  value
})

const mountWidget = async (
  api: BulletinApi = stubBulletin()
): Promise<{
  wrapper: VueWrapper
  api: BulletinApi
  store: ReturnType<typeof useSelectedDateStore>
}> => {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(WhatMovesWidget, {
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper, api, store: useSelectedDateStore() }
}

const stubData = (): BulletinApi => {
  const api = stubBulletin()
  vi.mocked(api.mood.list)
    .mockResolvedValue({ ok: true, value: MOODS })
  vi.mocked(api.sleep.list)
    .mockResolvedValue({ ok: true, value: PERIODS })
  vi.mocked(api.sleep.getGoal)
    .mockResolvedValue({ ok: true, value: 420 })
  vi.mocked(api.habits.list)
    .mockResolvedValue({ ok: true, value: [MEDITATION] })
  vi.mocked(api.habits.listEntries)
    .mockResolvedValue({ ok: true, value: ENTRIES })
  vi.mocked(api.expenses.list)
    .mockResolvedValue({ ok: true, value: TRANSACTIONS })
  vi.mocked(api.expenses.getBudget).mockImplementation(
    async month => ({
      ok: true,
      value: month === '2026-09' ? null : budget(month)
    })
  )
  return api
}

const texts = (w: VueWrapper, part: string): string[] =>
  w.findAll(`.row > .${part}`).map(el => el.text())

describe('WhatMovesWidget', () => {
  useFixedToday()

  beforeEach(() => {
    vi.mocked(sleepRow).mockReturnValue({
      ...row('happy', 'good', '2.1× happy'),
      goalMinutes: 420
    })
    vi.mocked(habitsRow).mockReturnValue({
      ...row('anxious', 'good', '−40% anxious'),
      habit: MEDITATION
    })
    vi.mocked(expensesRow)
      .mockReturnValue(row('stressed', 'bad', '2× stressed'))
    vi.mocked(calendarRow)
      .mockReturnValue(row('neutral', 'neutral', '+18% neutral'))
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.clearAllMocks()
  })

  it('shows its title and the Cross-tracker label', async () => {
    const { wrapper: w } = await mountWidget(stubData())

    expect(w.get('.header > .title').text())
      .toBe('What moves your mood')
    expect(w.get('.header > .actions').text())
      .toBe('Cross-tracker')
  })

  it('loads the 90 days ending on the Selected Date',
    async () => {
      const { api } = await mountWidget(stubData())

      const window = { from: '2026-08-12', to: '2026-11-09' }
      expect(api.mood.list).toHaveBeenCalledWith(window)
      expect(api.sleep.list).toHaveBeenCalledWith(
        { from: '2026-08-11', to: '2026-11-10' }
      )
      expect(api.sleep.getGoal).toHaveBeenCalled()
      expect(api.habits.list).toHaveBeenCalledWith('all')
      expect(api.habits.listEntries).toHaveBeenCalledWith(window)
      expect(api.expenses.list).toHaveBeenCalledWith(
        { from: '2026-08-01', to: '2026-11-09' }
      )
      expect(vi.mocked(api.expenses.getBudget).mock.calls)
        .toEqual([['2026-08'], ['2026-09'], ['2026-10'], ['2026-11']])

      expect(sleepRow).toHaveBeenCalledWith(
        MOODS, PERIODS, 420, '2026-11-09'
      )
      expect(habitsRow).toHaveBeenCalledWith(
        MOODS, [MEDITATION], ENTRIES, '2026-11-09'
      )
      expect(expensesRow).toHaveBeenCalledWith(
        MOODS,
        TRANSACTIONS,
        new Map([
          ['2026-08', budget('2026-08')],
          ['2026-09', null],
          ['2026-10', budget('2026-10')],
          ['2026-11', budget('2026-11')]
        ]),
        '2026-11-09'
      )
      expect(calendarRow).toHaveBeenCalledWith(MOODS, '2026-11-09')
    })

  it('shows the four rows in order, with their values',
    async () => {
      const { wrapper: w } = await mountWidget(stubData())

      expect(texts(w, 'name')).toEqual([
        'Slept 7h or more',
        'Meditation',
        'Over budget pace',
        'Weekends'
      ])
      expect(texts(w, 'tracker'))
        .toEqual(['Sleep', 'Habits', 'Expenses', 'Calendar'])
      expect(texts(w, 'value')).toEqual([
        '2.1× happy',
        '−40% anxious',
        '2× stressed',
        '+18% neutral'
      ])
    })

  it('colours each row by its effect\'s tone', async () => {
    const { wrapper: w } = await mountWidget(stubData())

    expect(w.findAll('.row').map(r => r.attributes('data-tone')))
      .toEqual(['good', 'good', 'bad', 'neutral'])
  })

  it('writes a Sleep Goal with minutes in full', async () => {
    vi.mocked(sleepRow).mockReturnValue({
      ...row('happy', 'good', '2.1× happy'),
      goalMinutes: 450
    })
    const { wrapper: w } = await mountWidget(stubData())

    expect(texts(w, 'name')[0]).toBe('Slept 7h 30m or more')
  })

  it('hides the rows that have no effect', async () => {
    vi.mocked(sleepRow).mockReturnValue(null)
    vi.mocked(expensesRow).mockReturnValue(null)
    const { wrapper: w } = await mountWidget(stubData())

    expect(texts(w, 'tracker')).toEqual(['Habits', 'Calendar'])
  })

  it('reloads on the Selected Date and on its sources only',
    async () => {
      const { api, store } = await mountWidget(stubData())
      const calls = (): number =>
        vi.mocked(api.mood.list).mock.calls.length
      expect(calls()).toBe(1)

      store.setDay(new Date(2026, 9, 15))
      await flushPromises()
      expect(api.mood.list).toHaveBeenLastCalledWith(
        { from: '2026-07-18', to: '2026-10-15' }
      )
      expect(calls()).toBe(2)

      await api.mood.create({ date: '2026-10-15', mood: 'okay' })
      await api.sleep.setGoal(480)
      await api.sleep.create({ start: 0, end: 1 })
      await api.habits.createEntry(
        { habitId: 4, date: '2026-10-15' }
      )
      await api.habits.archive(4)
      await api.expenses.setBudget(
        { month: '2026-10', amount: 1 }
      )
      await flushPromises()
      expect(calls()).toBe(8)

      await api.weight.create({ date: '2026-10-15', grams: 70_000 })
      await api.sleepQuality.create(
        { date: '2026-10-15', rating: 3 }
      )
      await flushPromises()
      expect(calls()).toBe(8)
    })

  it('reloads when a Transaction changes', async () => {
    const { api } = await mountWidget(stubData())

    await api.expenses.delete(9)
    await flushPromises()
    expect(api.expenses.list).toHaveBeenCalledTimes(2)
  })

  it('drops a load a newer one overtook', async () => {
    const api = stubData()
    let resolveFirst!: (value: {
      ok: true
      value: MoodEntry[]
    }) => void
    vi.mocked(api.mood.list)
      .mockReturnValueOnce(new Promise(r => { resolveFirst = r }))
    const { wrapper: w, store } = await mountWidget(api)

    store.setDay(new Date(2026, 9, 15))
    await flushPromises()
    vi.mocked(calendarRow).mockClear()
    resolveFirst({
      ok: true,
      value: [{ date: '2026-11-01', mood: 'angry' }]
    })
    await flushPromises()

    expect(calendarRow).not.toHaveBeenCalled()
    expect(texts(w, 'tracker')).toHaveLength(4)
  })

  it('says so when a read fails', async () => {
    const api = stubData()
    vi.mocked(api.habits.listEntries)
      .mockResolvedValue({ ok: false, error: { code: 'internal' } })
    const { wrapper: w } = await mountWidget(api)

    expect(w.get('[role="alert"]').text())
      .toBe('Couldn’t load What moves your mood.')
    expect(w.find('.row').exists()).toBe(false)
  })
})
