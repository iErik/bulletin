import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BulletinApi } from '@shared/bridge'
import type { Habit, HabitEntry } from '@shared/habits'
import type { LocalDate } from '@shared/storage'
import GoalLine from '@/components/GoalLine/GoalLine.vue'
import { eachDay } from '@/habits/rules'
import { setLocaleOverride } from '@/locale/format'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import HabitOverviewWidget from './HabitOverviewWidget.vue'

let widget: VueWrapper | undefined

const habit = (id: number, name: string, extra?: Partial<Habit>): Habit => ({
  id, name, icon: 'meditation', created: '2026-01-01',
  archived: extra?.archivePeriods?.some(p => p.end === null) ?? false,
  archivePeriods: [], ...extra
})
const done = (habitId: number, from: LocalDate, to = from): HabitEntry[] =>
  eachDay({ from, to }).map(date => ({ habitId, date }))

const mountWidget = async (
  habits: Habit[] = [],
  entries: HabitEntry[] = []
): Promise<{ wrapper: VueWrapper; api: BulletinApi }> => {
  let stored = 75
  const api = stubBulletin()
  vi.mocked(api.habits.list).mockResolvedValue({ ok: true, value: habits })
  vi.mocked(api.habits.listEntries)
    .mockResolvedValue({ ok: true, value: entries })
  vi.mocked(api.habits.getGoal)
    .mockImplementation(async () => ({ ok: true, value: stored }))
  vi.mocked(api.habits.setGoal).mockImplementation(async next => {
    stored = next
    return { ok: true, value: next }
  })
  const pinia = createPinia()
  setActivePinia(pinia)
  widget = mount(HabitOverviewWidget, {
    attachTo: document.body, global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper: widget, api }
}

const statsOf = (w: VueWrapper): string[] =>
  w.findAll('.stat .value').map(v => v.text())
interface RowView { mid: string; val: string; tone?: string }
const row = (w: VueWrapper, name: string): RowView | null => {
  const el = w.findAll('.row').find(r => r.get('.name').text() === name)
  if (!el) return null
  const val = el.get('.val')
  return {
    mid: el.get('.mid').text(), val: val.text(),
    tone: val.classes().find(c => c.startsWith('-'))
  }
}

describe('HabitOverviewWidget', () => {
  useFixedToday()
  afterEach(() => {
    widget?.unmount()
    widget = undefined
    setLocaleOverride(null)
    document.body.innerHTML = ''
  })

  it('renders empty state, tiles, bars and rows', async () => {
    const empty = await mountWidget()
    expect(empty.wrapper.get('.title').text()).toBe('Overview')
    expect(empty.api.habits.list).toHaveBeenCalledWith('all')
    expect(empty.api.habits.listEntries).toHaveBeenCalledWith({
      from: '2026-08-18', to: '2026-11-09'
    })
    expect(statsOf(empty.wrapper)).toEqual(['—', '—', '—'])
    expect(empty.wrapper.findAll('.col')).toHaveLength(12)
    expect(empty.wrapper.findAll('.bar, .row')).toHaveLength(0)
    empty.wrapper.unmount()
    setLocaleOverride('en-US')
    const { wrapper } = await mountWidget([
      habit(1, 'Meditation'), habit(2, 'Reading'),
      habit(3, 'Vitamins', {
        archivePeriods: [{ start: '2026-11-01', end: null }]
      })
    ], [
      ...done(1, '2026-10-01', '2026-10-05'),
      ...done(2, '2026-10-01', '2026-10-31'),
      ...done(1, '2026-10-11', '2026-10-31'),
      ...done(1, '2026-11-01', '2026-11-08'),
      ...done(2, '2026-11-01', '2026-11-03')
    ])
    expect(statsOf(wrapper)).toEqual(['0 / 2', '3', '61%'])
    expect(wrapper.findAll('.week').at(-1)!.text()).toBe('W46')
    expect(wrapper.findAll('.row > .name').map(n => n.text())).toEqual([
      'Strongest', 'Slipping', 'Best day', 'Most skipped day', 'Trend'
    ])
    expect(row(wrapper, 'Strongest'))
      .toEqual({ mid: 'Meditation', val: '89%', tone: '-good' })
    expect(row(wrapper, 'Slipping'))
      .toEqual({ mid: 'Reading · 2 weeks', val: '↓43%', tone: '-bad' })
    expect(row(wrapper, 'Best day')!.mid).toBe('all habits')
    expect(row(wrapper, 'Most skipped day')!.mid).toBe('all habits')
    expect(row(wrapper, 'Trend'))
      .toEqual({ mid: 'vs last month', val: '+9%', tone: '-good' })
    wrapper.unmount()
    const h = habit(1, 'Walk')
    const neg = await mountWidget([h], [
      ...done(1, '2026-10-01', '2026-10-09'),
      ...done(1, '2026-11-01', '2026-11-07')
    ])
    expect(row(neg.wrapper, 'Slipping')).toBeNull()
    expect(row(neg.wrapper, 'Trend'))
      .toEqual({ mid: 'vs last month', val: '−22%', tone: '-bad' })
    neg.wrapper.unmount()
    const flat = await mountWidget([h], [
      ...done(1, '2026-10-01', '2026-10-09'),
      ...done(1, '2026-11-01', '2026-11-09')
    ])
    expect(row(flat.wrapper, 'Trend'))
      .toEqual({ mid: 'vs last month', val: '0%', tone: '-neutral' })
  })

  it('previews, Escapes, commits, clamps and reverts goal', async () => {
    setLocaleOverride('en-US')
    const hs = [1, 2, 3, 4, 5].map(id =>
      habit(id, `H${id}`, { created: '2026-11-08' }))
    const es = [1, 2, 3, 4].flatMap(id => done(id, '2026-11-08', '2026-11-09'))
    const { wrapper, api } = await mountWidget(hs, es)
    const bar = (): ReturnType<VueWrapper['get']> =>
      wrapper.findAll('.bar').at(-1)!
    expect(bar().classes()).toContain('-met')
    const slider = wrapper.get('[role="slider"]')
    const node = slider.element as HTMLElement
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 200, height: 200, left: 0, right: 343,
      width: 343, x: 0, y: 0, toJSON: () => ({})
    })
    const down = (clientY: number): boolean => node.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientY, bubbles: true })
    )
    down(20)
    await flushPromises()
    const line = wrapper.getComponent(GoalLine)
    expect(line.props('label')).toBe('90% goal')
    expect(bar().classes()).not.toContain('-met')
    await slider.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(line.props('label')).toBe('75% goal')
    expect(bar().classes()).toContain('-met')
    expect(api.habits.setGoal).not.toHaveBeenCalled()
    down(40)
    window.dispatchEvent(
      new PointerEvent('pointerup', { clientY: 40, bubbles: true })
    )
    await flushPromises()
    expect(api.habits.setGoal).toHaveBeenCalledWith(80)
    expect(bar().classes()).toContain('-met')
    for (let i = 0; i < 5; i++)
      await slider.trigger('keydown', { key: 'ArrowUp' })
    await flushPromises()
    expect(line.props('label')).toBe('100% goal')
    expect(api.habits.setGoal).toHaveBeenLastCalledWith(100)
    vi.mocked(api.habits.setGoal).mockResolvedValueOnce({
      ok: false, error: { code: 'internal' }
    })
    await slider.trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(line.props('label')).toBe('100% goal')
  })

  it('reloads on Habit writes/date, ignores unrelated', async () => {
    const { wrapper, api } = await mountWidget([habit(1, 'Run')], [])
    expect(statsOf(wrapper)[0]).toBe('0 / 1')
    const calls = (): number => vi.mocked(api.habits.list).mock.calls.length
    const before = calls()
    await api.mood.create({ date: '2026-11-09', mood: 'happy' })
    await flushPromises()
    expect(calls()).toBe(before)
    vi.mocked(api.habits.listEntries).mockResolvedValue({
      ok: true, value: [{ habitId: 1, date: '2026-11-09' }]
    })
    await api.habits.createEntry({ habitId: 1, date: '2026-11-09' })
    await flushPromises()
    expect(statsOf(wrapper)[0]).toBe('1 / 1')
    const afterEntry = calls()
    await api.habits.create({ name: 'Yoga', icon: 'yoga' })
    await flushPromises()
    expect(calls()).toBe(afterEntry + 1)
    await api.habits.setGoal(85)
    await flushPromises()
    expect(calls()).toBe(afterEntry + 2)
    vi.mocked(api.habits.list).mockResolvedValue({
      ok: false, error: { code: 'internal' }
    })
    useSelectedDateStore().setDay(new Date(2026, 10, 8))
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Couldn’t load')
  })
})
