import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { MoodEntry, MoodKey } from '@shared/mood'
import type { SleepPeriod } from '@shared/sleep'
import type { BulletinApi } from '@shared/bridge'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import SleepMoodWidget from './SleepMoodWidget.vue'

let widget: VueWrapper | undefined
const at = (d: number, h: number, m = 0): number =>
  new Date(2026, 10, d, h, m).getTime()
const period = (
  start: number,
  end: number,
  id = start
): SleepPeriod => ({ id, start, end })
const night75 = (wake: number): SleepPeriod =>
  period(at(wake - 1, 23), at(wake, 6, 30), wake)
const mood = (date: string, key: MoodKey): MoodEntry =>
  ({ date, mood: key })

const mountWidget = async (
  moods: MoodEntry[] = [],
  periods: SleepPeriod[] = [],
  revision = 0
): Promise<{ wrapper: VueWrapper; api: BulletinApi }> => {
  const api = stubBulletin()
  vi.mocked(api.mood.list)
    .mockResolvedValue({ ok: true, value: moods })
  vi.mocked(api.sleep.list)
    .mockResolvedValue({ ok: true, value: periods })
  const pinia = createPinia()
  setActivePinia(pinia)
  widget = mount(SleepMoodWidget, {
    props: { revision },
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper: widget, api }
}

const row = (
  w: VueWrapper,
  label: string
): DOMWrapper<Element> =>
  w.findAll('.row').find(r => r.get('.label').text() === label)!

describe('SleepMoodWidget', () => {
  useFixedToday()
  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('loads, renders shares and follows Selected Date', async () => {
    const { wrapper, api } = await mountWidget(
      [
        mood('2026-11-03', 'anxious'),
        mood('2026-11-04', 'happy'),
        mood('2026-11-05', 'angry'),
        mood('2026-11-06', 'okay'),
        mood('2026-11-07', 'happy')
      ],
      [3, 4, 5, 6, 7].map(night75)
    )
    expect(wrapper.get('.title').text()).toBe('Sleep & Mood')
    expect(api.mood.list).toHaveBeenCalledWith({
      from: '1970-01-01', to: '2026-11-09'
    })
    const segs = row(wrapper, '7–8h').findAll('.segment')
    expect(segs[0].attributes('style')).toContain('flex-grow: 0.4')
    expect(segs[0].classes()).toContain('-glow')
    expect(wrapper.get('.headline').text())
      .toBe('40% happy after 7–8h')
    expect(wrapper.findAll('.legend .name').map(n => n.text()))
      .toEqual([
        'Happy', 'Okay', 'Neutral', 'Stressed', 'Anxious', 'Angry'
      ])

    const empty = await mountWidget()
    expect(empty.wrapper.find('.headline').exists()).toBe(false)
    expect(empty.wrapper.findAll('.track.-empty')).toHaveLength(4)

    vi.mocked(empty.api.mood.list).mockResolvedValue({
      ok: false, error: { code: 'internal' }
    })
    await empty.wrapper.setProps({ revision: 1 })
    await flushPromises()
    expect(empty.wrapper.get('[role="alert"]').text())
      .toContain('Couldn’t load')

    const later = [
      mood('2026-11-08', 'happy'), mood('2026-11-09', 'angry')
    ]
    const periods = [night75(8), night75(9)]
    const back = await mountWidget(later, periods)
    vi.mocked(back.api.mood.list)
      .mockResolvedValue({ ok: true, value: later })
    vi.mocked(back.api.sleep.list)
      .mockResolvedValue({ ok: true, value: periods })
    useSelectedDateStore().setDay(new Date(2026, 10, 8))
    await flushPromises()
    expect(back.wrapper.get('.headline').text())
      .toBe('100% happy after 7–8h')
  })
})
