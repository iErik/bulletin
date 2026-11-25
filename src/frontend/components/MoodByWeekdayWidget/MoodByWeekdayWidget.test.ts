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
import type { BulletinApi } from '@shared/bridge'
import type { MoodEntry, MoodKey } from '@shared/mood'
import type { LocalDate } from '@shared/storage'
import { setLocaleOverride } from '@/locale/format'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import MoodByWeekdayWidget from './MoodByWeekdayWidget.vue'

let widget: VueWrapper | undefined

const e = (date: LocalDate, mood: MoodKey): MoodEntry =>
  ({ date, mood })

const mountWidget = async (
  entries: MoodEntry[] = []
): Promise<{
  wrapper: VueWrapper
  api: BulletinApi
  store: ReturnType<typeof useSelectedDateStore>
}> => {
  const api = stubBulletin()
  vi.mocked(api.mood.list)
    .mockResolvedValue({ ok: true, value: entries })
  const pinia = createPinia()
  setActivePinia(pinia)
  widget = mount(MoodByWeekdayWidget, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper: widget, api, store: useSelectedDateStore() }
}

const labels = (w: VueWrapper): string[] =>
  w.findAll('.column > .label').map(l => l.text())

describe('MoodByWeekdayWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('reads the 90 days ending on the Selected Date',
    async () => {
      const { wrapper: w, api } = await mountWidget()

      expect(api.mood.list).toHaveBeenCalledWith({
        from: '2026-08-12',
        to: '2026-11-09'
      })
      expect(w.get('.widget-frame > .header > .title').text())
        .toBe('By Weekday')
      expect(w.get('.actions > .subtitle').text())
        .toBe('Last 90 days')
    })

  it('stacks each weekday\'s Mood shares, Happy first',
    async () => {
      // Mondays: Nov 9 and 2, Oct 26 and 19.
      const { wrapper: w } = await mountWidget([
        e('2026-11-09', 'happy'),
        e('2026-11-02', 'happy'),
        e('2026-10-26', 'angry'),
        e('2026-10-19', 'okay'),
        // A Tuesday.
        e('2026-11-03', 'stressed')
      ])

      const columns = w.findAll('.column')
      expect(labels(w))
        .toEqual(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'])
      const monday = columns[1]
        .findAll<HTMLElement>('.segment')
      expect(monday.map(s => s.attributes('data-mood')))
        .toEqual(['happy', 'okay', 'angry'])
      expect(monday.map(s => s.element.style.flexGrow))
        .toEqual(['0.5', '0.25', '0.25'])
      expect(monday[0].element.style
        .getPropertyValue('--mood'))
        .toBe('var(--color-mood-happy)')
      expect(columns[1].get('.bar').attributes('aria-label'))
        .toBe('Mon: 50% Happy, 25% Okay, 25% Angry')
      // A weekday with no logged days has no bar.
      expect(columns[0].find('.bar').exists()).toBe(false)
      expect(columns[2].findAll('.segment')).toHaveLength(1)
    })

  it('makes the best weekday\'s label bold', async () => {
    const { wrapper: w } = await mountWidget([
      e('2026-11-03', 'happy'),
      e('2026-11-02', 'okay')
    ])

    const best = w.findAll('.column > .label')
      .filter(l => l.classes('-best'))
    expect(best.map(l => l.text())).toEqual(['TUE'])
  })

  it('starts on the Locale\'s first day of the week',
    async () => {
      setLocaleOverride('en-GB')
      const { wrapper: w } = await mountWidget([
        e('2026-11-02', 'happy')
      ])

      expect(labels(w))
        .toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
    })

  it('shows a notice when no day is logged', async () => {
    const { wrapper: w } = await mountWidget()

    expect(w.get('.message').text())
      .toBe('No moods logged yet')
    expect(w.find('.columns').exists()).toBe(false)
  })

  it('shows an error when the Moods can\'t load',
    async () => {
      const api = stubBulletin()
      vi.mocked(api.mood.list).mockResolvedValue({
        ok: false,
        error: { code: 'not-found' }
      })
      const pinia = createPinia()
      setActivePinia(pinia)
      widget = mount(MoodByWeekdayWidget, {
        global: { plugins: [pinia] }
      })
      await flushPromises()

      expect(widget.get('[role="alert"]').text())
        .toBe('Couldn’t load By Weekday.')
      expect(widget.find('.subtitle').exists()).toBe(false)
    })

  it('reloads on a Selected Date change and Mood writes',
    async () => {
      const { api, store } = await mountWidget()

      store.setDay(new Date(2026, 9, 15))
      await flushPromises()
      expect(api.mood.list).toHaveBeenLastCalledWith({
        from: '2026-07-18',
        to: '2026-10-15'
      })

      const calls = vi.mocked(api.mood.list).mock.calls.length
      await api.mood.create({ date: '2026-10-15', mood: 'happy' })
      await flushPromises()
      expect(api.mood.list).toHaveBeenCalledTimes(calls + 1)

      await api.weight.create({ date: '2026-10-15', grams: 70000 })
      await flushPromises()
      expect(api.mood.list).toHaveBeenCalledTimes(calls + 1)
    })
})
