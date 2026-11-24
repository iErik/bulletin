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
import type { SleepPeriod } from '@shared/sleep'
import type { BulletinApi } from '@shared/bridge'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { useSleepGoalStore }
  from '@/stores/sleep-goal'
import GoalLine from '@/components/GoalLine/GoalLine.vue'
import SleepOverviewWidget from './SleepOverviewWidget.vue'

let widget: VueWrapper | undefined
const at = (d: number, h: number, m = 0): number =>
  new Date(2026, 10, d, h, m).getTime()
const period = (
  start: number,
  end: number,
  id = start
): SleepPeriod => ({ id, start, end })
const night = (
  wake: number,
  hours: number,
  id = wake
): SleepPeriod =>
  period(at(wake, 7) - hours * 3_600_000, at(wake, 7), id)

const mountWidget = async (
  periods: SleepPeriod[] = [],
  goal = 8 * 60,
  revision = 0
): Promise<{ wrapper: VueWrapper; api: BulletinApi }> => {
  const api = stubBulletin()
  vi.mocked(api.sleep.list)
    .mockResolvedValue({ ok: true, value: periods })
  vi.mocked(api.sleep.getGoal)
    .mockResolvedValue({ ok: true, value: goal })
  vi.mocked(api.sleep.setGoal)
    .mockImplementation(async minutes =>
      ({ ok: true, value: minutes }))
  const pinia = createPinia()
  setActivePinia(pinia)
  widget = mount(SleepOverviewWidget, {
    props: { revision },
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper: widget, api }
}

const stat = (
  w: VueWrapper,
  label: string
): ReturnType<VueWrapper['get']> =>
  w.findAll('.stat').find(t =>
    t.get('.label').text().includes(label)
  )!.get('.value')

const row = (
  w: VueWrapper,
  name: string
): { mid: string; val: string } => {
  const el = w.findAll('.row').find(r =>
    r.get('.name').text() === name
  )!
  return { mid: el.get('.mid').text(), val: el.get('.val').text() }
}

describe('SleepOverviewWidget', () => {
  useFixedToday()
  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('renders stats, bars, rows and empty states',
    async () => {
      const empty = await mountWidget()
      expect(empty.wrapper.get('.title').text())
        .toBe('Overview')
      expect(stat(empty.wrapper, 'Avg sleep').text())
        .toBe('—')
      expect(stat(empty.wrapper, 'Streak').text())
        .toBe('0 nights')
      expect(row(empty.wrapper, 'Naps'))
        .toEqual({ mid: '0 this week', val: '—' })
      expect(empty.wrapper.findAll('.col')).toHaveLength(14)
      const periods = [
        night(7, 7), night(8, 9), night(9, 6),
        period(at(9, 14), at(9, 14, 35), 900)
      ]
      const { wrapper, api } = await mountWidget(periods)
      expect(api.sleep.list).toHaveBeenCalledWith({
        from: '1969-12-31', to: '2026-11-10'
      })
      expect(stat(wrapper, 'Avg sleep').text())
        .toBe('7h 20m')
      expect(stat(wrapper, 'Sleep debt').text())
        .toBe('−2h 00m')
      expect(stat(wrapper, 'Sleep debt').classes())
        .toContain('-debt')
      expect(row(wrapper, 'Naps').val).toBe('avg 35m')
      const zero = await mountWidget([night(9, 8)])
      expect(stat(zero.wrapper, 'Sleep debt').text())
        .toBe('+0h 00m')
    })

  it('previews, Escapes, commits; follows date/revision',
    async () => {
      const periods = [
        night(7, 8), night(8, 8), night(9, 8)
      ]
      const { wrapper, api } = await mountWidget(periods)
      const slider = wrapper.get('[role="slider"]')
      const node = slider.element as HTMLElement
      vi.spyOn(node, 'getBoundingClientRect')
        .mockReturnValue({
          top: 0, bottom: 480, height: 480,
          left: 0, right: 100, width: 100,
          x: 0, y: 0, toJSON: () => ({})
        })
      node.dispatchEvent(new PointerEvent(
        'pointerdown',
        { button: 0, clientY: 120, bubbles: true }
      ))
      await flushPromises()
      const line = wrapper.getComponent(GoalLine)
      expect(line.props('label')).toBe('10h goal')
      expect(stat(wrapper, 'Streak').text())
        .toBe('0 nights')

      await slider.trigger('keydown', { key: 'Escape' })
      await flushPromises()
      expect(line.props('label')).toBe('8h goal')
      expect(stat(wrapper, 'Streak').text())
        .toBe('3 nights')
      expect(api.sleep.setGoal).not.toHaveBeenCalled()

      line.vm.$emit('commit', 7 * 60 + 30)
      await flushPromises()
      expect(api.sleep.setGoal)
        .toHaveBeenCalledWith(7 * 60 + 30)
      expect(useSleepGoalStore().minutes)
        .toBe(7 * 60 + 30)

      useSelectedDateStore()
        .setDay(new Date(2026, 10, 8))
      await flushPromises()
      expect(stat(wrapper, 'Streak').text())
        .toBe('2 nights')

      vi.mocked(api.sleep.list).mockResolvedValue({
        ok: false, error: { code: 'internal' }
      })
      await wrapper.setProps({ revision: 1 })
      await flushPromises()
      expect(wrapper.get('[role="alert"]').text())
        .toContain('Couldn’t load')
    })
})
