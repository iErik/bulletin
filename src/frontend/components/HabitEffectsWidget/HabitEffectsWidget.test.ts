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
import type { Transaction } from '@shared/expenses'
import type {
  Habit,
  HabitEntry,
  HabitIcon
} from '@shared/habits'
import type { MoodEntry } from '@shared/mood'
import type { SleepPeriod } from '@shared/sleep'
import {
  calendarEffect,
  expensesEffect,
  moodEffect,
  sleepEffect,
  type CalendarEffectRow,
  type ExpensesEffectRow,
  type MoodEffectRow,
  type SleepEffectRow
} from '@/habits/effects'
import type { EffectTone, MoodEffect }
  from '@/mood/mood-effect'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import HabitEffectsWidget from './HabitEffectsWidget.vue'

vi.mock('@/habits/effects', () => ({
  sleepEffect: vi.fn(),
  moodEffect: vi.fn(),
  expensesEffect: vi.fn(),
  calendarEffect: vi.fn()
}))

let wrapper: VueWrapper | undefined

const habit = (
  id: number,
  name: string,
  icon: HabitIcon = 'exercise'
): Habit => ({
  id,
  name,
  icon,
  created: '2026-01-01',
  archived: false,
  archivePeriods: []
})

const EXERCISE = habit(1, 'Exercise', 'exercise')
const MEDITATION = habit(2, 'Meditation', 'meditation')
const NO_SMOKING = habit(3, 'No-smoking', 'no-smoking')
const READING = habit(4, 'Reading', 'reading')
const HABITS = [EXERCISE, MEDITATION, NO_SMOKING, READING]
const ENTRIES: HabitEntry[] = [
  { habitId: 1, date: '2026-11-08' }
]
const PERIODS: SleepPeriod[] = [{ id: 1, start: 0, end: 1 }]
const MOODS: MoodEntry[] = [
  { date: '2026-11-08', mood: 'happy' }
]
const TRANSACTIONS = [{ id: 9 }] as unknown as Transaction[]

const stubData = (): BulletinApi => {
  const api = stubBulletin()
  vi.mocked(api.habits.list)
    .mockResolvedValue({ ok: true, value: HABITS })
  vi.mocked(api.habits.listEntries)
    .mockResolvedValue({ ok: true, value: ENTRIES })
  vi.mocked(api.sleep.list)
    .mockResolvedValue({ ok: true, value: PERIODS })
  vi.mocked(api.mood.list)
    .mockResolvedValue({ ok: true, value: MOODS })
  vi.mocked(api.expenses.list)
    .mockResolvedValue({ ok: true, value: TRANSACTIONS })
  return api
}

const mountWidget = async (
  api: BulletinApi = stubData()
): Promise<{
  wrapper: VueWrapper
  api: BulletinApi
  store: ReturnType<typeof useSelectedDateStore>
}> => {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(HabitEffectsWidget, {
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper, api, store: useSelectedDateStore() }
}

const sleepRow = (
  value = '+41 min',
  tone: EffectTone = 'good'
): SleepEffectRow => ({
  habit: EXERCISE, value, tone, effect: 41, minutes: 41
})

const moodRow = (
  value = '2× happy',
  tone: EffectTone = 'good'
): MoodEffectRow => ({
  habit: MEDITATION,
  value,
  tone,
  effect: 2,
  mood: { mood: 'happy', tone } as MoodEffect
})

const spendRow = (
  value = 'R$30.00 saved',
  tone: EffectTone = 'good'
): ExpensesEffectRow => ({
  habit: NO_SMOKING,
  value,
  tone,
  effect: 3_000,
  savedCentavos: 3_000
})

const calRow = (value = 'Fridays'): CalendarEffectRow => ({
  habit: READING,
  value,
  tone: 'bad',
  effect: 0.6,
  weekday: 5,
  count: 3,
  total: 5
})

const texts = (w: VueWrapper, part: string): string[] =>
  w.findAll(`.row > .${part}`).map(el => el.text())

describe('HabitEffectsWidget', () => {
  useFixedToday()

  beforeEach(() => {
    vi.mocked(sleepEffect).mockReturnValue(sleepRow())
    vi.mocked(moodEffect).mockReturnValue(moodRow())
    vi.mocked(expensesEffect).mockReturnValue(spendRow())
    vi.mocked(calendarEffect).mockReturnValue(calRow())
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.clearAllMocks()
  })

  it('shows its title and the Cross-tracker label',
    async () => {
      const { wrapper: w } = await mountWidget()

      expect(w.get('.header > .title').text())
        .toBe('Habit effects')
      expect(w.get('.header > .actions').text())
        .toBe('Cross-tracker')
    })

  it('loads the 90-day window and full Habit Entries',
    async () => {
      const { api } = await mountWidget()
      const window = { from: '2026-08-12', to: '2026-11-09' }

      expect(api.habits.list).toHaveBeenCalledWith('all')
      expect(api.habits.listEntries).toHaveBeenCalledWith({
        from: '1970-01-01',
        to: '2026-11-09'
      })
      expect(api.sleep.list).toHaveBeenCalledWith({
        from: '2026-08-12',
        to: '2026-11-10'
      })
      expect(api.mood.list).toHaveBeenCalledWith(window)
      expect(api.expenses.list).toHaveBeenCalledWith(window)

      expect(sleepEffect).toHaveBeenCalledWith(
        HABITS, ENTRIES, PERIODS, '2026-11-09'
      )
      expect(moodEffect).toHaveBeenCalledWith(
        HABITS, ENTRIES, MOODS, '2026-11-09'
      )
      expect(expensesEffect).toHaveBeenCalledWith(
        HABITS, ENTRIES, TRANSACTIONS, '2026-11-09'
      )
      expect(calendarEffect).toHaveBeenCalledWith(
        HABITS, ENTRIES, '2026-11-09'
      )
    })

  it('shows the four rows in order, with labels and values',
    async () => {
      const { wrapper: w } = await mountWidget()

      expect(texts(w, 'label')).toEqual([
        'Exercise days',
        'Meditation days',
        'No-smoking days',
        'Reading streaks end on'
      ])
      expect(texts(w, 'tracker')).toEqual([
        'Sleep', 'Mood', 'Expenses', 'Calendar'
      ])
      expect(texts(w, 'value')).toEqual([
        '+41 min', '2× happy', 'R$30.00 saved', 'Fridays'
      ])
      expect(
        w.findAll('.row > .label')[3].attributes('title')
      ).toBe('Reading streaks end on')
    })

  it('colours each row by its tone, including Neutral grey',
    async () => {
      vi.mocked(moodEffect)
        .mockReturnValue(moodRow('1.5× neutral', 'neutral'))
      const { wrapper: w } = await mountWidget()

      expect(
        w.findAll('.row').map(r => r.attributes('data-tone'))
      ).toEqual(['good', 'neutral', 'good', 'bad'])
      expect(texts(w, 'value')[1]).toBe('1.5× neutral')
    })

  it('hides rows that do not qualify', async () => {
    vi.mocked(sleepEffect).mockReturnValue(null)
    vi.mocked(expensesEffect).mockReturnValue(null)
    const { wrapper: w } = await mountWidget()

    expect(texts(w, 'tracker')).toEqual(['Mood', 'Calendar'])
  })

  it('leaves the list empty when no row qualifies',
    async () => {
      vi.mocked(sleepEffect).mockReturnValue(null)
      vi.mocked(moodEffect).mockReturnValue(null)
      vi.mocked(expensesEffect).mockReturnValue(null)
      vi.mocked(calendarEffect).mockReturnValue(null)
      const { wrapper: w } = await mountWidget()

      expect(w.findAll('.row')).toHaveLength(0)
      expect(w.find('[role="alert"]').exists()).toBe(false)
    })

  it('reloads on the Selected Date and its five sources',
    async () => {
      const { api, store } = await mountWidget()
      const calls = (): number =>
        vi.mocked(api.habits.list).mock.calls.length
      expect(calls()).toBe(1)

      store.setDay(new Date(2026, 9, 15))
      await flushPromises()
      expect(api.mood.list).toHaveBeenLastCalledWith({
        from: '2026-07-18',
        to: '2026-10-15'
      })
      expect(calls()).toBe(2)

      await api.habits.archive(1)
      await api.habits.createEntry(
        { habitId: 1, date: '2026-10-15' }
      )
      await api.sleep.create({ start: 0, end: 1 })
      await api.mood.create(
        { date: '2026-10-15', mood: 'okay' }
      )
      await api.expenses.delete(9)
      await flushPromises()
      expect(calls()).toBe(7)

      await api.habits.setGoal(80)
      await api.sleep.setGoal(480)
      await api.sleepQuality.create(
        { date: '2026-10-15', rating: 3 }
      )
      await api.expenses.setBudget(
        { month: '2026-10', amount: 1 }
      )
      await api.weight.create(
        { date: '2026-10-15', grams: 70_000 }
      )
      await flushPromises()
      expect(calls()).toBe(7)
    })

  it('keeps the snapshot date until the new load finishes',
    async () => {
      const api = stubData()
      const { store } = await mountWidget(api)
      vi.mocked(sleepEffect).mockClear()

      let resolveNext!: (value: {
        ok: true
        value: MoodEntry[]
      }) => void
      vi.mocked(api.mood.list).mockReturnValueOnce(
        new Promise(r => { resolveNext = r })
      )

      store.setDay(new Date(2026, 9, 15))
      await flushPromises()
      expect(sleepEffect).not.toHaveBeenCalled()

      resolveNext({ ok: true, value: MOODS })
      await flushPromises()
      expect(sleepEffect).toHaveBeenCalledWith(
        HABITS, ENTRIES, PERIODS, '2026-10-15'
      )
    })

  it('drops a load a newer one overtook', async () => {
    const api = stubData()
    let resolveFirst!: (value: {
      ok: true
      value: MoodEntry[]
    }) => void
    vi.mocked(api.mood.list).mockReturnValueOnce(
      new Promise(r => { resolveFirst = r })
    )
    const { wrapper: w, store } = await mountWidget(api)

    store.setDay(new Date(2026, 9, 15))
    await flushPromises()
    vi.mocked(calendarEffect).mockClear()
    resolveFirst({
      ok: true,
      value: [{ date: '2026-11-01', mood: 'angry' }]
    })
    await flushPromises()

    expect(calendarEffect).not.toHaveBeenCalled()
    expect(texts(w, 'tracker')).toHaveLength(4)
  })

  it('says so when a read fails', async () => {
    const api = stubData()
    vi.mocked(api.sleep.list).mockResolvedValue({
      ok: false,
      error: { code: 'internal' }
    })
    const { wrapper: w } = await mountWidget(api)

    expect(w.get('[role="alert"]').text())
      .toBe('Couldn’t load Habit effects.')
    expect(w.find('.row').exists()).toBe(false)
  })
})
