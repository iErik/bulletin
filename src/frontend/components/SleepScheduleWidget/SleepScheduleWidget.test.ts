import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { SleepPeriod } from '@shared/sleep'
import type { BulletinApi } from '@shared/bridge'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { setLocaleOverride } from '@/locale/format'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import SleepScheduleWidget from './SleepScheduleWidget.vue'

let widget: VueWrapper | undefined

const at = (d: number, h: number, m = 0): number =>
  new Date(2026, 10, d, h, m).getTime()

const period = (
  start: number,
  end: number,
  id = start
): SleepPeriod => ({ id, start, end })

const mountWidget = async (
  periods: SleepPeriod[] = [],
  revision = 0
): Promise<{ wrapper: VueWrapper; api: BulletinApi }> => {
  const api = stubBulletin()
  vi.mocked(api.sleep.list)
    .mockResolvedValue({ ok: true, value: periods })
  const pinia = createPinia()
  setActivePinia(pinia)
  widget = mount(SleepScheduleWidget, {
    props: { revision },
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper: widget, api }
}

describe('SleepScheduleWidget', () => {
  useFixedToday()
  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('renders Locale rows, dots, averages and ±',
    async () => {
      // Today is Sun 9 Nov 2026. Nights ending Sat and
      // Sun give ±30 min around a 00:00 average bed.
      const { wrapper, api } = await mountWidget([
        period(at(7, 23, 30), at(8, 7)),
        period(at(9, 0, 30), at(9, 7, 30))
      ])

      expect(wrapper.get('.title').text())
        .toBe('Schedule')
      expect(api.sleep.list).toHaveBeenCalledWith({
        from: '2026-11-07',
        to: '2026-11-10'
      })
      expect(
        wrapper.findAll('.weekday').map(n => n.text())
      ).toEqual([
        'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'
      ])
      expect(wrapper.findAll('.dot')).toHaveLength(4)
      expect(wrapper.findAll('.span')).toHaveLength(2)
      expect(wrapper.findAll('.average')).toHaveLength(2)
      expect(wrapper.get('.deviation').text())
        .toBe('±30 min')
      expect(
        wrapper.findAll('.mark').map(m => m.text())
      ).toEqual([
        '22', '00', '02', '04', '06', '08', '10'
      ])
      // Selected Date is Mon 9: Sun+Mon drawn, later blank.
      const tracks = wrapper.findAll('.track')
      expect(tracks).toHaveLength(7)
      expect(tracks[0].findAll('.dot')).toHaveLength(2)
      expect(tracks[1].findAll('.dot')).toHaveLength(2)
      for (const track of tracks.slice(2))
        expect(track.find('.dot').exists()).toBe(false)
    })

  it('hides averages and ± when the week is empty',
    async () => {
      const { wrapper } = await mountWidget()
      expect(wrapper.find('.deviation').exists())
        .toBe(false)
      expect(wrapper.findAll('.average')).toHaveLength(0)
      expect(wrapper.findAll('.dot')).toHaveLength(0)
      expect(wrapper.findAll('.weekday')).toHaveLength(7)
    })

  it('follows Selected Date and revision, reports errors',
    async () => {
      const night = period(at(8, 23, 10), at(9, 7, 5))
      const { wrapper, api } = await mountWidget([
        night,
        period(at(7, 22), at(8, 6))
      ])
      expect(wrapper.findAll('.dot')).toHaveLength(4)
      expect(wrapper.get('.deviation').text())
        .toMatch(/^±\d+ min$/)

      useSelectedDateStore()
        .setDay(new Date(2026, 10, 8))
      await flushPromises()
      // Only the Night ending Sat 8 remains.
      expect(wrapper.findAll('.dot')).toHaveLength(2)
      expect(wrapper.get('.deviation').text())
        .toBe('±0 min')

      const calls = vi.mocked(api.sleep.list).mock.calls
        .length
      await wrapper.setProps({ revision: 1 })
      await flushPromises()
      expect(vi.mocked(api.sleep.list).mock.calls.length)
        .toBeGreaterThan(calls)

      vi.mocked(api.sleep.list).mockResolvedValue({
        ok: false, error: { code: 'internal' }
      })
      await wrapper.setProps({ revision: 2 })
      await flushPromises()
      expect(wrapper.get('[role="alert"]').text())
        .toContain('Couldn’t load')
    })

  it('orders rows by Locale week start', async () => {
    setLocaleOverride('en-GB')
    const { wrapper } = await mountWidget()
    expect(
      wrapper.findAll('.weekday').map(n => n.text())
    ).toEqual([
      'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'
    ])
  })
})
