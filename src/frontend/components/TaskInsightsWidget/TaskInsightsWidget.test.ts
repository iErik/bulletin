import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BulletinApi } from '@shared/bridge'
import type { Occurrence } from '@shared/recurring-tasks'
import type { LocalDate } from '@shared/storage'
import type { LocalTime, Task } from '@shared/tasks'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import TaskInsightsWidget from './TaskInsightsWidget.vue'

// Today is Monday, Nov 9th 2026 (en-US week starts Sun).
// Sun-start week holding Nov 9: Nov 8–14.
// 4 weeks ahead: Nov 15–21, Nov 22–28, Nov 29–Dec 5, Dec 6–12.
// 90 days ending Nov 9: 2026-08-12..2026-11-09.

let widget: VueWrapper | undefined
let nextId = 1

const at = (day: LocalDate, hour = 12): number => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, hour).getTime()
}

const task = (
  day: LocalDate | null,
  opts: {
    time?: LocalTime | null
    doneAt?: number | null
    moves?: number
  } = {}
): Task => ({
  id: nextId++,
  title: 'Task',
  day,
  time: opts.time ?? null,
  reminder: null,
  doneAt: opts.doneAt ?? null,
  created: at('2026-10-01', 9),
  moves: opts.moves ?? 0
})

const occ = (
  day: LocalDate,
  opts: {
    time?: LocalTime | null
    doneAt?: number | null
    moves?: number
  } = {}
): Occurrence => ({
  ruleId: 1,
  scheduled: day,
  title: 'Recurring',
  day,
  time: opts.time ?? null,
  reminder: null,
  doneAt: opts.doneAt ?? null,
  moves: opts.moves ?? 0,
  created: at('2026-10-01', 9)
})

const many = <T>(n: number, build: () => T): T[] =>
  Array.from({ length: n }, build)

// Sample yielding all 5 rows:
// - Completion: 50 planned in Nov (39 done, 32 on time -> 78%, 64%)
// - Productive day: 39 done on Tue Nov 3 -> 39/12 = 3.25 -> avg 3.3 done
// - Evening slip: 10 evening (4 slipped) vs 10 day (2 slipped) -> 2× more
// - Rescheduled: 3 open with moves 3, 4, 5 (done with 6 ignored)
// - Busiest week ahead: 14 tasks in Nov 15–21
const sampleData = (): {
  planned: Task[]
  someday: Task[]
  occurrences: Occurrence[]
} => {
  const planned: Task[] = [
    // 10 evening timed in Oct (4 slipped, 6 on time) + 10 daytime (2 slipped)
    ...many(4, () => task('2026-10-15', { time: '21:00' })),
    ...many(6, () => task('2026-10-15', {
      time: '21:00', doneAt: at('2026-10-15', 22)
    })),
    ...many(2, () => task('2026-10-15', { time: '10:00' })),
    ...many(8, () => task('2026-10-15', {
      time: '10:00', doneAt: at('2026-10-15', 11)
    })),
    // 50 planned in Nov 1–9: 32 done on Tue Nov 3 (on time),
    // 7 done late on Tue Nov 3 (planned Nov 2), 11 undone (incl. 1 Occ).
    ...many(32, () => task('2026-11-03', { doneAt: at('2026-11-03') })),
    ...many(7, () => task('2026-11-02', { doneAt: at('2026-11-03') })),
    ...many(8, () => task('2026-11-05')),
    task('2026-11-05', { moves: 3 }),
    task('2026-11-05', { moves: 4 }),
    // Done with 6 moves outside Nov (ignored by rescheduled & Nov).
    task('2026-10-01', { doneAt: at('2026-10-01'), moves: 6 }),
    // 10 tasks in week 1 ahead (Nov 15–21) + 4 Occurrences below = 14.
    ...many(10, () => task('2026-11-16'))
  ]
  const someday: Task[] = [task(null, { moves: 5 })]
  const occurrences: Occurrence[] = [
    // 1 missed Occurrence in Nov (makes 50 planned, 11 undone).
    occ('2026-11-06'),
    ...many(4, () => occ('2026-11-18'))
  ]
  return { planned, someday, occurrences }
}

const mountWidget = async (options: {
  planned?: Task[]
  someday?: Task[]
  occurrences?: Occurrence[]
} = {}): Promise<{ wrapper: VueWrapper; api: BulletinApi }> => {
  const sample = sampleData()
  const api = stubBulletin()
  vi.mocked(api.tasks.list).mockResolvedValue(
    { ok: true, value: options.planned ?? sample.planned }
  )
  vi.mocked(api.tasks.listSomeday).mockResolvedValue(
    { ok: true, value: options.someday ?? sample.someday }
  )
  vi.mocked(api.recurringTasks.listOccurrences).mockResolvedValue(
    { ok: true, value: options.occurrences ?? sample.occurrences }
  )
  const pinia = createPinia()
  setActivePinia(pinia)
  widget = mount(TaskInsightsWidget, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper: widget, api }
}

const rowsOf = (wrapper: VueWrapper): string[][] =>
  wrapper.findAll('.row').map(row => [
    row.get('.label').text(),
    row.get('.caption').text(),
    row.get('.value').text(),
    row.attributes('data-tone') ?? ''
  ])

describe('TaskInsightsWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('shows its title and "This month"', async () => {
    const { wrapper } = await mountWidget()

    expect(wrapper.get('.title').text()).toBe('Insights')
    expect(wrapper.get('.actions .subtitle').text())
      .toBe('This month')
  })

  it('loads one-off Tasks, Someday Tasks and Occurrences', async () => {
    const { api } = await mountWidget()

    expect(api.tasks.list).toHaveBeenCalledWith(
      { from: '1970-01-01', to: '9999-12-31' }
    )
    expect(api.tasks.listSomeday).toHaveBeenCalledOnce()
    expect(api.recurringTasks.listOccurrences).toHaveBeenCalledWith(
      { from: '2026-08-12', to: '2026-12-12' }
    )
  })

  it('draws all five rows in order with tones', async () => {
    const { wrapper } = await mountWidget()

    expect(rowsOf(wrapper)).toEqual([
      ['Completion', 'on time 64%', '78%', 'good'],
      ['Most productive day', 'avg 3.3 done', 'Tue', 'neutral'],
      ['Evening tasks slip', 'planned after 20:00', '2× more', 'bad'],
      ['Rescheduled 3+ times', 'break them down?', '3 tasks', 'neutral'],
      ['Busiest week ahead', 'Nov 15–21', '14 tasks', 'neutral']
    ])
  })

  it('hides uncomputable rows and tones less evening slip good',
    async () => {
      const { wrapper } = await mountWidget({
        planned: [
          ...many(2, () => task('2026-10-15', { time: '21:00' })),
          ...many(8, () => task('2026-10-15', {
            time: '21:00', doneAt: at('2026-10-15', 22)
          })),
          ...many(4, () => task('2026-10-15', { time: '10:00' })),
          ...many(6, () => task('2026-10-15', {
            time: '10:00', doneAt: at('2026-10-15', 11)
          }))
        ],
        someday: [],
        occurrences: []
      })

      expect(rowsOf(wrapper)).toEqual([
        ['Most productive day', 'avg 1.2 done', 'Thu', 'neutral'],
        ['Evening tasks slip', 'planned after 20:00', '2× less', 'good']
      ])
    })

  it('shows an empty message when no rows can be computed', async () => {
    const { wrapper } = await mountWidget({
      planned: [], someday: [], occurrences: []
    })

    expect(wrapper.find('.rows').exists()).toBe(false)
    expect(wrapper.get('.message').text()).toBe('No insights yet')
  })

  it('reports a failed load and recovers on next write', async () => {
    const api = stubBulletin()
    vi.mocked(api.tasks.list).mockResolvedValueOnce(
      { ok: false, error: { code: 'internal' } }
    )
    const pinia = createPinia()
    setActivePinia(pinia)
    widget = mount(TaskInsightsWidget, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(widget.get('[role="alert"]').text())
      .toBe('Couldn’t load Insights.')
    expect(widget.find('.rows').exists()).toBe(false)

    await api.tasks.create({ title: 'A', day: '2026-11-09', time: null })
    await flushPromises()
    expect(widget.find('[role="alert"]').exists()).toBe(false)
  })

  it('reloads on Selected Date change and Task/Occurrence writes',
    async () => {
      const { api } = await mountWidget()

      useSelectedDateStore().setDay(new Date(2026, 9, 15))
      await flushPromises()
      expect(api.recurringTasks.listOccurrences)
        .toHaveBeenLastCalledWith({
          from: '2026-07-18', to: '2026-11-14'
        })

      const writes = [
        () => api.tasks.setDone({ id: 1, done: true }),
        () => api.recurringTasks.setOccurrenceDone({
          ruleId: 1, scheduled: '2026-11-09', done: true
        })
      ]
      for (const write of writes) {
        vi.mocked(api.tasks.list).mockClear()
        await write()
        await flushPromises()
        expect(api.tasks.list).toHaveBeenCalledOnce()
      }
    })

  it('keeps old rows while loading and drops overtaken loads',
    async () => {
      const { wrapper, api } = await mountWidget()
      const shown = rowsOf(wrapper)
      let release: () => void = () => {}
      vi.mocked(api.tasks.list).mockImplementationOnce(
        () => new Promise(resolve => {
          release = () => resolve({ ok: true, value: [] })
        })
      )
      const store = useSelectedDateStore()
      store.setDay(new Date(2026, 9, 5))
      await flushPromises()
      expect(rowsOf(wrapper)).toEqual(shown)

      store.setDay(new Date(2026, 10, 9))
      await flushPromises()
      release()
      await flushPromises()
      expect(rowsOf(wrapper)).toEqual(shown)
    })
})
