import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BulletinApi } from '@shared/bridge'
import type { MoodEntry, MoodKey } from '@shared/mood'
import type { LocalDate } from '@shared/storage'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import YearInMoodWidget from './YearInMoodWidget.vue'

let widget: VueWrapper | undefined

const mood = (date: LocalDate, key: MoodKey): MoodEntry =>
  ({ date, mood: key })

/** Mounts with a mutable in-memory Mood store. */
const mountWidget = async (
  initial: MoodEntry[] = []
): Promise<{
  wrapper: VueWrapper
  api: BulletinApi
  store: ReturnType<typeof useSelectedDateStore>
}> => {
  const entries = new Map<LocalDate, MoodKey>(
    initial.map(e => [e.date, e.mood])
  )
  const api = stubBulletin()
  vi.mocked(api.mood.list).mockImplementation(
    async ({ from, to }) => ({
      ok: true,
      value: [...entries.entries()]
        .filter(([d]) => d >= from && d <= to)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, m]) => ({ date, mood: m }))
    })
  )
  vi.mocked(api.mood.create).mockImplementation(
    async entry => {
      entries.set(entry.date, entry.mood)
      return { ok: true, value: entry }
    }
  )
  vi.mocked(api.mood.delete).mockImplementation(
    async date => {
      entries.delete(date)
      return { ok: true, value: null }
    }
  )
  const pinia = createPinia()
  setActivePinia(pinia)
  widget = mount(YearInMoodWidget, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return {
    wrapper: widget,
    api,
    store: useSelectedDateStore()
  }
}

const monthEl = (
  w: VueWrapper,
  month: number
): Omit<DOMWrapper<Element>, 'exists'> =>
  w.get(`.month[data-month="${month}"]`)

const dayPill = (
  w: VueWrapper,
  month: number,
  day: number
): DOMWrapper<HTMLButtonElement> =>
  monthEl(w, month)
    .findAll<HTMLButtonElement>('.pill')[day - 1]

// Today is November 9th, 2026 (day 313 of 2026).
describe('YearInMoodWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('shows the header, 12 months, mix bars & legend',
    async () => {
      const jan = [
        mood('2026-01-01', 'happy'),
        mood('2026-01-02', 'happy'),
        mood('2026-01-03', 'happy'),
        mood('2026-01-04', 'happy'),
        mood('2026-01-05', 'okay'),
        mood('2026-01-06', 'okay'),
        mood('2026-01-07', 'neutral'),
        mood('2026-01-08', 'stressed'),
        mood('2026-01-09', 'anxious'),
        mood('2026-01-10', 'angry')
      ]
      const { wrapper, api } = await mountWidget(jan)

      expect(api.mood.list).toHaveBeenCalledWith({
        from: '2026-01-01',
        to: '2026-11-09'
      })
      expect(wrapper.get('.title').text())
        .toBe('Year in Mood')
      expect(wrapper.get('.summary').text())
        .toBe('2026 · 10 of 313 days logged')
      expect(wrapper.findAll('.month')).toHaveLength(12)
      expect(wrapper.findAll('.month-grid.-compact'))
        .toHaveLength(12)

      const janBlock = monthEl(wrapper, 0)
      expect(janBlock.get('.happy').text()).toBe('40% happy')
      expect(
        janBlock.findAll('.mix .segment')
          .map(s => s.attributes('data-mood'))
      ).toEqual([
        'happy', 'okay', 'neutral',
        'stressed', 'anxious', 'angry'
      ])

      expect(monthEl(wrapper, 10).get('.name').classes())
        .toContain('-current')
      expect(monthEl(wrapper, 11).find('.happy').exists())
        .toBe(false)
      expect(monthEl(wrapper, 11).find('.mix').exists())
        .toBe(false)

      expect(
        wrapper.findAll('.legend .label').map(l => l.text())
      ).toEqual([
        'Happy', 'Okay', 'Neutral',
        'Stressed', 'Anxious', 'Angry'
      ])
    })

  it('makes days after Selected Date inert, incl. December',
    async () => {
      const { wrapper, store } = await mountWidget()

      expect(dayPill(wrapper, 10, 9).classes())
        .toContain('-selected')
      expect(dayPill(wrapper, 10, 10).classes())
        .toContain('-disabled')

      const decPills = monthEl(wrapper, 11).findAll('.pill')
      expect(decPills.every(p => p.classes('-disabled')))
        .toBe(true)

      // Stepping Selected Date back makes days after it inert.
      store.setDay(new Date(2026, 10, 5))
      await flushPromises()
      expect(dayPill(wrapper, 10, 6).classes())
        .toContain('-disabled')
    })

  it('shows a previous year when Selected Date moves to it',
    async () => {
      const { wrapper, api, store } = await mountWidget([
        mood('2025-06-10', 'happy')
      ])

      store.setDay(new Date(2025, 10, 21))
      await flushPromises()

      expect(api.mood.list).toHaveBeenLastCalledWith({
        from: '2025-01-01',
        to: '2025-11-21'
      })
      expect(wrapper.get('.summary').text())
        .toBe('2025 · 1 of 325 days logged')
      expect(dayPill(wrapper, 5, 10).attributes('aria-label'))
        .toBe('Jun 10 · Happy')
    })

  it('reloads on Mood writes only, and shows load errors',
    async () => {
      const { wrapper, api } = await mountWidget()
      const calls = vi.mocked(api.mood.list).mock.calls.length

      await api.weight.delete('2026-11-09')
      await flushPromises()
      expect(api.mood.list).toHaveBeenCalledTimes(calls)

      await api.mood.create(mood('2026-05-01', 'happy'))
      await flushPromises()
      expect(api.mood.list).toHaveBeenCalledTimes(calls + 1)
      expect(wrapper.get('.summary').text())
        .toBe('2026 · 1 of 313 days logged')
      expect(dayPill(wrapper, 4, 1).attributes('aria-label'))
        .toBe('May 1 · Happy')
      expect(monthEl(wrapper, 4).get('.happy').text())
        .toBe('100% happy')

      vi.mocked(api.mood.list).mockResolvedValue({
        ok: false,
        error: { code: 'internal' }
      })
      await api.mood.delete('2026-05-01')
      await flushPromises()
      expect(wrapper.get('[role="alert"]').text())
        .toBe('Couldn’t load Year in Mood.')
    })
})
