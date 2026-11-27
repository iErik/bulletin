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
import type {
  DueReminder,
  ReminderOffset
} from '@shared/reminders'
import type { Occurrence } from '@shared/recurring-tasks'
import type { LocalDate } from '@shared/storage'
import type { LocalTime, Task } from '@shared/tasks'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import RemindersWidget from './RemindersWidget.vue'

// Nov 9th 2026 is a Monday (en-US week starts Sun).
let nextId = 1
let widget: VueWrapper | undefined

type MutableTask = { -readonly [K in keyof Task]: Task[K] }

const task = (
  day: LocalDate,
  opts: {
    time?: LocalTime | null
    doneAt?: number | null
    reminder?: ReminderOffset | null
    title?: string
  } = {}
): MutableTask => ({
  id: nextId++,
  title: opts.title ?? 'Dentist',
  day,
  time: opts.time ?? null,
  reminder: opts.reminder ?? null,
  doneAt: opts.doneAt ?? null,
  created: 0,
  moves: 0
})

const occurrence = (
  day: LocalDate,
  opts: {
    time?: LocalTime | null
    doneAt?: number | null
  } = {}
): Occurrence => ({
  ruleId: 1,
  scheduled: day,
  title: 'Recurring',
  day,
  time: opts.time ?? null,
  reminder: null,
  doneAt: opts.doneAt ?? null,
  moves: 0,
  created: 0
})

const taskReminder = (
  t: Task,
  offset: ReminderOffset,
  dueAt: number
): Extract<DueReminder, { kind: 'task' }> => ({
  kind: 'task',
  task: t,
  offset,
  dueAt,
  notifiedAt: null
})

const occurrenceReminder = (
  o: Occurrence,
  offset: ReminderOffset,
  dueAt: number
): Extract<DueReminder, { kind: 'occurrence' }> => ({
  kind: 'occurrence',
  occurrence: o,
  offset,
  dueAt,
  notifiedAt: null
})

const at = (day: LocalDate, hour: number, minute = 0): number => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, hour, minute).getTime()
}

const entries = (wrapper: VueWrapper): string[] =>
  wrapper.findAll('.entry').map(el => el.text())

const mountWidget = async (
  value: DueReminder[]
): Promise<{ wrapper: VueWrapper; api: BulletinApi }> => {
  const api = stubBulletin()
  vi.mocked(api.reminders.listDue).mockImplementation(
    async ({ from, to }) => ({
      ok: true,
      value: value.filter(r => {
        const done = r.kind === 'task'
          ? r.task.doneAt
          : r.occurrence.doneAt
        return done == null && r.dueAt >= from && r.dueAt <= to
      })
    })
  )
  setActivePinia(createPinia())
  widget = mount(RemindersWidget, {
    attachTo: document.body
  })
  await flushPromises()
  return { wrapper: widget, api }
}

describe('RemindersWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('shows the title, the bell and "Next 7 days"', async () => {
    const { wrapper } = await mountWidget([])

    expect(wrapper.get('.title').text()).toBe('Reminders')
    expect(wrapper.find('.tile .app-icon').exists()).toBe(true)
    expect(wrapper.get('.actions .subtitle').text())
      .toBe('Next 7 days')
  })

  it('queries the next 7 days from now', async () => {
    const { api } = await mountWidget([])

    expect(api.reminders.listDue).toHaveBeenCalledTimes(1)
    const { from, to } = vi.mocked(api.reminders.listDue)
      .mock.calls[0][0]
    const now = new Date().getTime()
    expect(from).toBe(now)
    expect(to - from).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('shows Tasks only, soonest first', async () => {
    const done = task('2026-11-09', {
      time: '17:00',
      reminder: { kind: 'minutes', minutes: 30 }
    })
    const recurring = occurrence('2026-11-09')
    const { wrapper } = await mountWidget([
      taskReminder(done, { kind: 'minutes', minutes: 30 },
        at('2026-11-09', 16, 30)),
      occurrenceReminder(recurring, {
        kind: 'minutes', minutes: 30
      }, at('2026-11-09', 17, 0))
    ])

    expect(wrapper.findAll('.entry')).toHaveLength(1)
    expect(entries(wrapper)[0]).toContain('Dentist in 30 min')
  })

  it('shows "Today 09:30 · Dentist in 30 min" at 09:00', async () => {
    vi.useFakeTimers({
      now: new Date(2026, 10, 9, 9, 0)
    })
    const t = task('2026-11-09', {
      time: '10:00',
      reminder: { kind: 'minutes', minutes: 30 }
    })
    const { wrapper } = await mountWidget([
      taskReminder(t, { kind: 'minutes', minutes: 30 },
        at('2026-11-09', 9, 30))
    ])

    expect(wrapper.get('.entry .label').text()).toBe('Today 09:30')
    expect(wrapper.get('.entry .text').text())
      .toBe('Dentist in 30 min')
  })

  it('shows "Thu 18:00 · <Task> (2 days before)"', async () => {
    const t = task('2026-11-14', {
      time: '20:00',
      reminder: { kind: 'days', days: 2, time: '18:00' }
    })
    const { wrapper } = await mountWidget([
      taskReminder(t, { kind: 'days', days: 2, time: '18:00' },
        at('2026-11-12', 18, 0))
    ])

    expect(wrapper.get('.entry .label').text()).toBe('Thu 18:00')
    expect(wrapper.get('.entry .text').text())
      .toBe('Dentist (2 days before)')
  })

  it('shows the first entry as soonest', async () => {
    const { wrapper } = await mountWidget([
      taskReminder(task('2026-11-09'), {
        kind: 'minutes', minutes: 30
      }, at('2026-11-09', 16, 0)),
      taskReminder(task('2026-11-09'), {
        kind: 'minutes', minutes: 30
      }, at('2026-11-10', 9, 0))
    ])

    const entries = wrapper.findAll('.entry')
    expect(entries).toHaveLength(2)
    expect(entries[0].attributes('data-soonest')).toBe('true')
    expect(entries[1].attributes('data-soonest')).toBe('false')
  })

  it('does not react to the Selected Date', async () => {
    const { wrapper } = await mountWidget([
      taskReminder(task('2026-11-09'), {
        kind: 'minutes', minutes: 30
      }, at('2026-11-09', 16, 0))
    ])
    const before = entries(wrapper)

    useSelectedDateStore().setDay(new Date(2026, 9, 12))
    await flushPromises()

    expect(entries(wrapper)).toEqual(before)
  })

  it('drops a Reminder whose moment passed', async () => {
    const t = task('2026-11-09', {
      time: '10:00',
      reminder: { kind: 'minutes', minutes: 30 }
    })
    const { wrapper, api } = await mountWidget([
      taskReminder(t, { kind: 'minutes', minutes: 30 },
        at('2026-11-09', 15, 45))
    ])
    expect(wrapper.findAll('.entry')).toHaveLength(1)

    // The moment passes; the next tick reloads.
    vi.setSystemTime(new Date(2026, 10, 9, 15, 46))
    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()

    expect(wrapper.findAll('.entry')).toHaveLength(0)
    expect(wrapper.get('.message').text()).toBe('No reminders due')
    expect(api.reminders.listDue).toHaveBeenCalled()
  })

  it('drops a Reminder once its Task is done', async () => {
    const t = task('2026-11-09', {
      time: '10:00',
      reminder: { kind: 'minutes', minutes: 30 }
    })
    const fixture = [taskReminder(t, {
      kind: 'minutes', minutes: 30
    }, at('2026-11-09', 16, 0))]
    const { wrapper, api } = await mountWidget(fixture)
    expect(wrapper.findAll('.entry')).toHaveLength(1)

    // The backend persists the write, then notifies.
    t.doneAt = 1
    await api.tasks.setDone({ id: t.id, done: true })
    await flushPromises()

    expect(wrapper.findAll('.entry')).toHaveLength(0)
    expect(wrapper.get('.message').text()).toBe('No reminders due')
  })

  it('opens the Task in the editor when an entry is clicked', async () => {
    const t = task('2026-11-09', {
      time: '10:00',
      reminder: { kind: 'minutes', minutes: 30 }
    })
    const { wrapper } = await mountWidget([
      taskReminder(t, { kind: 'minutes', minutes: 30 },
        at('2026-11-09', 16, 0))
    ])

    await wrapper.get('.entry').trigger('click')
    await flushPromises()

    const editor = document.querySelector('.task-editor')
    expect(editor).not.toBeNull()
    expect(
      (document.querySelector('.task-editor .input') as HTMLInputElement).value
    ).toBe('Dentist')

    document.body.innerHTML = ''
  })

  it('shows an empty message when nothing is due', async () => {
    const { wrapper } = await mountWidget([])

    expect(wrapper.find('.entry').exists()).toBe(false)
    expect(wrapper.get('.message').text()).toBe('No reminders due')
  })

  it('reports a failed load', async () => {
    const api = stubBulletin()
    vi.mocked(api.reminders.listDue).mockResolvedValue({
      ok: false,
      error: { code: 'internal' }
    })
    setActivePinia(createPinia())
    const wrapper = mount(RemindersWidget, {
      attachTo: document.body
    })
    await flushPromises()

    expect(wrapper.get('.message').text())
      .toBe('Couldn’t load Reminders.')
    expect(wrapper.get('.message').attributes('role')).toBe('alert')
  })
})
