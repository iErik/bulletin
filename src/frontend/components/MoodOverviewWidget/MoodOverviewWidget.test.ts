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
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { addDays, format } from 'date-fns'
import type { BulletinApi } from '@shared/bridge'
import type { MoodEntry, MoodKey } from '@shared/mood'
import type {
  LocalDate,
  StorageResult
} from '@shared/storage'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import MoodOverviewWidget from './MoodOverviewWidget.vue'

let widget: VueWrapper | undefined

const e = (date: LocalDate, mood: MoodKey): MoodEntry =>
  ({ date, mood })

/** `days` Entries of `mood` from `from` on. */
const run = (
  from: string,
  days: number,
  mood: MoodKey
): MoodEntry[] => Array.from({ length: days }, (_, i) =>
  e(format(addDays(new Date(`${from}T12:00`), i), 'yyyy-MM-dd'),
    mood))

const mountWidget = async (
  entries: MoodEntry[] = [],
  day?: Date
): Promise<{ wrapper: VueWrapper; api: BulletinApi }> => {
  const api = stubBulletin()
  vi.mocked(api.mood.list)
    .mockResolvedValue({ ok: true, value: entries })
  const pinia = createPinia()
  setActivePinia(pinia)
  if (day) useSelectedDateStore().setDay(day)
  widget = mount(MoodOverviewWidget, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper: widget, api }
}

const stat = (w: VueWrapper, label: string): string =>
  w.findAll('.stat').find(t =>
    t.get('.label').text() === label
  )!.get('.value').text()

const rows = (w: VueWrapper): string[] =>
  w.findAll('.row').map(r => r.get('.name').text())

const row = (
  w: VueWrapper,
  name: string
): { mid: string; val: ReturnType<VueWrapper['get']> } => {
  const el = w.findAll('.row').find(r =>
    r.get('.name').text() === name
  )!
  return { mid: el.get('.mid').text(), val: el.get('.val') }
}

const segments = (w: VueWrapper, bar: number): string[][] =>
  w.findAll('.mix-row')[bar].findAll('.segment').map(s =>
    [s.attributes('data-mood')!, s.text()])

// Oct 2 Fri stressed, Oct 3-5 anxious, Oct 6-7 stressed;
// Nov 2 Mon stressed, Nov 3 okay. Selected: Nov 9.
const patterns = [
  e('2026-10-02', 'stressed'),
  ...run('2026-10-03', 3, 'anxious'),
  ...run('2026-10-06', 2, 'stressed'),
  e('2026-11-02', 'stressed'),
  e('2026-11-03', 'okay')
]

describe('MoodOverviewWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
  })

  it('loads every Mood up to the Selected Date', async () => {
    const { api } = await mountWidget()

    expect(api.mood.list).toHaveBeenCalledWith({
      from: '1970-01-01',
      to: '2026-11-09'
    })
  })

  it('reloads when the Selected Date changes', async () => {
    const { api } = await mountWidget()

    useSelectedDateStore().step(-1)
    await flushPromises()

    expect(api.mood.list).toHaveBeenLastCalledWith({
      from: '1970-01-01',
      to: '2026-11-08'
    })
  })

  it('drops an earlier load that resolves late', async () => {
    let finishFirst!: (v: StorageResult<MoodEntry[]>) => void
    const first = new Promise<StorageResult<MoodEntry[]>>(r => {
      finishFirst = r
    })
    const api = stubBulletin()
    vi.mocked(api.mood.list)
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({
        ok: true,
        value: [e('2026-11-08', 'okay')]
      })
    const pinia = createPinia()
    setActivePinia(pinia)
    widget = mount(MoodOverviewWidget, {
      attachTo: document.body,
      global: { plugins: [pinia] }
    })

    useSelectedDateStore().step(-1)
    await flushPromises()
    finishFirst({ ok: true, value: [e('2026-11-09', 'happy')] })
    await flushPromises()

    expect(stat(widget, 'Most common')).toBe('Okay 100%')
  })

  it('shows Most common, Good streak and Logged 88% on 288/325',
    async () => {
      // Nov 21 is day 325 of 2026; 288 logged days -> 88%.
      vi.setSystemTime(new Date(2026, 10, 21, 15, 30))
      const { wrapper } = await mountWidget([
        ...run('2026-01-01', 280, 'happy'),
        ...run('2026-10-08', 8, 'okay')
      ])

      expect(stat(wrapper, 'Most common')).toBe('Happy 97%')
      expect(stat(wrapper, 'Good streak')).toBe('0 days')
      expect(stat(wrapper, 'Logged')).toBe('88%')
      expect(
        wrapper.findAll('.stat .value')[0].attributes('style')
      ).toContain('var(--color-mood-happy)')
    })

  it('counts a Good streak back past Jan 1', async () => {
    const { wrapper } = await mountWidget(
      run('2025-12-28', 7, 'okay'),
      new Date(2026, 0, 3)
    )

    expect(stat(wrapper, 'Good streak')).toBe('7 days')
    expect(stat(wrapper, 'Logged')).toBe('100%')
  })

  it('counts from the day before without a Mood today',
    async () => {
      const { wrapper } = await mountWidget(
        run('2026-11-08', 1, 'happy')
      )

      expect(stat(wrapper, 'Good streak')).toBe('1 day')
    })

  it('keeps a Dec streak on Jan 1 before any Mood this year',
    async () => {
      const { wrapper } = await mountWidget(
        run('2025-12-28', 4, 'happy'),
        new Date(2026, 0, 1)
      )

      expect(stat(wrapper, 'Most common')).toBe('—')
      expect(stat(wrapper, 'Good streak')).toBe('4 days')
      expect(stat(wrapper, 'Logged')).toBe('—')
    })

  it('shows dashes and empty tracks when there are no Moods',
    async () => {
      const { wrapper } = await mountWidget()

      for (const label of ['Most common', 'Good streak', 'Logged'])
        expect(stat(wrapper, label)).toBe('—')
      expect(wrapper.findAll('.mix-row .month').map(m => m.text()))
        .toEqual(['Nov', 'Oct'])
      expect(wrapper.findAll('.segment')).toHaveLength(0)
      expect(wrapper.find('.patterns').exists()).toBe(false)
    })

  it('compares Mar 31 against Feb 1-28 in display order',
    async () => {
      const { wrapper } = await mountWidget([
        e('2026-02-01', 'anxious'),
        e('2026-02-28', 'happy'),
        e('2026-03-01', 'angry'),
        e('2026-03-02', 'anxious'),
        e('2026-03-03', 'stressed'),
        e('2026-03-04', 'neutral'),
        e('2026-03-05', 'okay'),
        e('2026-03-31', 'happy')
      ], new Date(2026, 2, 31))

      expect(wrapper.findAll('.mix-row .month').map(m => m.text()))
        .toEqual(['Mar', 'Feb'])
      expect(segments(wrapper, 0)).toEqual([
        ['happy', '16%'],
        ['okay', '16%'],
        ['neutral', '16%'],
        ['stressed', '16%'],
        ['anxious', '16%'],
        ['angry', '16%']
      ])
      expect(segments(wrapper, 1)).toEqual([
        ['happy', '50%'],
        ['anxious', '50%']
      ])
    })

  it('hides a segment label under 10% and keeps empty tracks',
    async () => {
      const { wrapper } = await mountWidget([
        ...run('2026-10-01', 19, 'happy'),
        e('2026-10-20', 'anxious')
      ], new Date(2026, 9, 20))

      expect(segments(wrapper, 0)).toEqual([
        ['happy', '95%'],
        ['anxious', '']
      ])
      expect(wrapper.findAll('.mix-row .month')[1].text())
        .toBe('Sep')
      expect(segments(wrapper, 1)).toEqual([])
    })

  it('shows computable Patterns rows in order', async () => {
    const { wrapper } = await mountWidget(patterns)

    expect(wrapper.get('.patterns > .heading').text())
      .toBe('Patterns')
    expect(rows(wrapper)).toEqual([
      'Toughest weekday',
      'Stressed days',
      'Longest anxious run',
      'Most improved'
    ])
    const tough = row(wrapper, 'Toughest weekday')
    expect(tough.mid).toBe('Sun')
    expect(tough.val.text()).toBe('100% anxious')
    expect(tough.val.attributes('style'))
      .toContain('var(--color-mood-anxious)')
    const run3 = row(wrapper, 'Longest anxious run')
    expect(run3.mid).toBe('Oct 3–5')
    expect(run3.val.text()).toBe('3 days')
    const improved = row(wrapper, 'Most improved')
    expect(improved.mid).toBe('vs Oct')
    expect(improved.val.text()).toBe('+50% okay')
    expect(improved.val.classes()).toContain('-better')
  })

  it('shows the Best weekday in Happy colour', async () => {
    const { wrapper } = await mountWidget([
      e('2026-11-07', 'happy'),
      e('2026-11-06', 'okay')
    ])

    const best = row(wrapper, 'Best weekday')
    expect(best.mid).toBe('Sat')
    expect(best.val.text()).toBe('100% happy')
    expect(best.val.attributes('style'))
      .toContain('var(--color-mood-happy)')
  })

  it('colours Stressed days by their change', async () => {
    const { wrapper } = await mountWidget(patterns)
    const down = row(wrapper, 'Stressed days')
    expect(down.mid).toBe('this month')
    expect(down.val.text()).toBe('1  ↓2')
    expect(down.val.classes()).toContain('-better')
    wrapper.unmount()

    const up = await mountWidget([
      e('2026-10-01', 'okay'),
      ...run('2026-11-02', 2, 'stressed')
    ])
    const rise = row(up.wrapper, 'Stressed days').val
    expect(rise.text()).toBe('2  ↑2')
    expect(rise.classes()).toContain('-worse')
    up.wrapper.unmount()

    const same = await mountWidget([
      e('2026-10-02', 'stressed'),
      e('2026-11-02', 'stressed')
    ])
    const flat = row(same.wrapper, 'Stressed days').val
    expect(flat.text()).toBe('1')
    expect(flat.classes()).not.toContain('-better')
    expect(flat.classes()).not.toContain('-worse')
  })

  it('shows a Hard Mood falling with a minus sign', async () => {
    const { wrapper } = await mountWidget([
      e('2026-10-01', 'stressed'),
      e('2026-10-02', 'happy'),
      e('2026-11-02', 'happy'),
      e('2026-11-03', 'neutral')
    ])

    expect(row(wrapper, 'Most improved').val.text())
      .toBe('−50% stressed')
  })

  it('reloads on mood writes and ignores unrelated writes',
    async () => {
      const { wrapper, api } = await mountWidget()
      expect(api.mood.list).toHaveBeenCalledTimes(1)

      await api.sleep.create({ start: 1, end: 2 })
      await api.weight.delete('2026-11-09')
      await flushPromises()
      expect(api.mood.list).toHaveBeenCalledTimes(1)

      vi.mocked(api.mood.list).mockResolvedValue({
        ok: true,
        value: [e('2026-11-09', 'happy')]
      })
      await api.mood.create({
        date: '2026-11-09',
        mood: 'happy'
      })
      await flushPromises()
      expect(api.mood.list).toHaveBeenCalledTimes(2)
      expect(stat(wrapper, 'Most common')).toBe('Happy 100%')
      expect(row(wrapper, 'Best weekday').mid).toBe('Mon')

      vi.mocked(api.mood.list).mockResolvedValue({
        ok: true,
        value: [e('2026-11-09', 'okay')]
      })
      await api.mood.update({
        date: '2026-11-09',
        mood: 'okay'
      })
      await flushPromises()
      expect(api.mood.list).toHaveBeenCalledTimes(3)
      expect(stat(wrapper, 'Most common')).toBe('Okay 100%')

      vi.mocked(api.mood.list).mockResolvedValue({
        ok: true,
        value: []
      })
      await api.mood.delete('2026-11-09')
      await flushPromises()
      expect(api.mood.list).toHaveBeenCalledTimes(4)
      expect(wrapper.find('.patterns').exists()).toBe(false)
    })

  it('says so when the Moods fail to load', async () => {
    const api = stubBulletin()
    vi.mocked(api.mood.list).mockResolvedValue({
      ok: false,
      error: { code: 'not-found' }
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    widget = mount(MoodOverviewWidget, {
      global: { plugins: [pinia] }
    })
    await flushPromises()

    expect(widget.get('[role="alert"]').text())
      .toBe('Couldn’t load Overview.')
    expect(widget.find('.stats').exists()).toBe(false)
    expect(widget.find('.mix').exists()).toBe(false)
    expect(widget.find('.patterns').exists()).toBe(false)
  })
})
