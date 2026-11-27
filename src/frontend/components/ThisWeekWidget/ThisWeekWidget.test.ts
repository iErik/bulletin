import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BulletinApi } from '@shared/bridge'
import { setLocaleOverride } from '@/locale/format'
import type { Occurrence } from '@shared/recurring-tasks'
import type { LocalDate } from '@shared/storage'
import type { ReminderOffset } from '@shared/reminders'
import type { LocalTime, Task } from '@shared/tasks'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import ThisWeekWidget from './ThisWeekWidget.vue'

// Today is Monday, Nov 9th 2026 (en-US week starts Sun):
// the week holding Nov 9 is Nov 8–14 (Sun–Sat).

let widget: VueWrapper | undefined
let nextId = 1

const at = (day: LocalDate, hour = 12): number => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, hour).getTime()
}

interface TaskOpts {
  time?: LocalTime | null
  doneAt?: number | null
  reminder?: ReminderOffset | null
  created?: number
  title?: string
}

const task = (
  day: LocalDate | null,
  opts: TaskOpts = {}
): Task => ({
  id: nextId++,
  title: opts.title ?? 'Task',
  day,
  time: opts.time ?? null,
  reminder: opts.reminder ?? null,
  doneAt: opts.doneAt ?? null,
  created: opts.created ?? at('2026-10-01', 9),
  moves: 0
})

interface OccurrenceOpts {
  time?: LocalTime | null
  doneAt?: number | null
  created?: number
  title?: string
}

const occurrence = (
  day: LocalDate,
  opts: OccurrenceOpts = {}
): Occurrence => ({
  ruleId: 1,
  scheduled: day,
  title: opts.title ?? 'Recurring',
  day,
  time: opts.time ?? null,
  reminder: null,
  doneAt: opts.doneAt ?? null,
  moves: 0,
  created: opts.created ?? at('2026-10-01', 9)
})

const mountWidget = async (options: {
  planned?: Task[]
  occurrences?: Occurrence[]
  selected?: Date
} = {}): Promise<{ wrapper: VueWrapper; api: BulletinApi }> => {
  const api = stubBulletin()
  vi.mocked(api.tasks.list).mockResolvedValue({
    ok: true,
    value: options.planned ?? []
  })
  vi.mocked(api.recurringTasks.listOccurrences).mockResolvedValue({
    ok: true,
    value: options.occurrences ?? []
  })
  const pinia = createPinia()
  setActivePinia(pinia)
  if (options.selected)
    useSelectedDateStore().setDay(options.selected)
  widget = mount(ThisWeekWidget, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper: widget, api }
}

const columnFor = (
  wrapper: VueWrapper,
  date: LocalDate
): DOMWrapper<Element> => {
  const col = wrapper.find(`.column[data-day="${date}"]`)
  if (!col.exists()) throw new Error(`No column for ${date}`)
  return col
}

describe('ThisWeekWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('shows the title, the range and seven day columns', async () => {
    const { wrapper } = await mountWidget({
      planned: [task('2026-11-09')]
    })

    expect(wrapper.get('.title').text()).toBe('This Week')
    expect(wrapper.get('.actions .range').text()).toBe('Nov 8 – 14')
    const cols = wrapper.findAll('.column')
    expect(cols).toHaveLength(7)
    expect(cols.map(c => c.get('.weekday').text()))
      .toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    expect(cols.map(c => c.get('.day').text()))
      .toEqual(['8', '9', '10', '11', '12', '13', '14'])
  })

  it('highlights the Selected Date column', async () => {
    const { wrapper } = await mountWidget({
      planned: [task('2026-11-09')]
    })

    expect(columnFor(wrapper, '2026-11-09').classes())
      .toContain('-selected')
    expect(wrapper.findAll('.column').filter(c => c.classes()
      .includes('-selected'))).toHaveLength(1)
  })

  it('shows an empty message when the week has no cards', async () => {
    const { wrapper } = await mountWidget()

    expect(wrapper.find('.board').exists()).toBe(false)
    expect(wrapper.get('.message').text()).toBe('No tasks this week')
  })

  it('shows time, any time, repeat icon and bell', async () => {
    const recurring = occurrence('2026-11-09', {
      created: at('2026-11-09', 10), title: 'Recurring'
    })
    const { wrapper } = await mountWidget({
      planned: [
        task('2026-11-09', { time: '10:00', title: 'Timed' }),
        task('2026-11-09', { created: at('2026-11-09', 9), title: 'Any time' }),
        task('2026-11-10', {
          time: '09:30',
          reminder: { kind: 'minutes', minutes: 30 },
          title: 'Reminded'
        })
      ],
      occurrences: [recurring]
    })

    const cards = columnFor(wrapper, '2026-11-09').findAll('.card')
    expect(cards.map(c => c.get('.title').text()))
      .toEqual(['Timed', 'Any time', 'Recurring'])
    expect(cards[0].get('.time').text()).toBe('10:00 AM')
    expect(cards[1].get('.time').text()).toBe('any time')
    expect(cards[1].find('.mark').exists()).toBe(false)
    expect(cards[2].get('.time').text()).toBe('any time')
    // The repeat icon marks the Occurrence.
    expect(cards[2].find('.mark').exists()).toBe(true)

    const tue = columnFor(wrapper, '2026-11-10')
    // The bell marks the Task with a Reminder.
    expect(tue.find('.card .mark').exists()).toBe(true)
  })

  it('strikes through and dims Done Tasks', async () => {
    const { wrapper } = await mountWidget({
      planned: [
        task('2026-11-09', { doneAt: at('2026-11-09', 13), title: 'Done' }),
        task('2026-11-09', { title: 'Open' })
      ]
    })

    const cards = columnFor(wrapper, '2026-11-09').findAll('.card')
    const doneCard = cards.find(c => c.get('.title').text() === 'Done')!
    const openCard = cards.find(c => c.get('.title').text() === 'Open')!
    expect(doneCard.classes()).toContain('-done')
    expect(openCard.classes()).not.toContain('-done')
  })

  it('marks Overdue Tasks and never Occurrences', async () => {
    const { wrapper } = await mountWidget({
      planned: [
        task('2026-11-08', { title: 'Late' }),
        task('2026-11-08', { doneAt: at('2026-11-08', 18), title: 'Done Late' })
      ],
      occurrences: [occurrence('2026-11-08', { title: 'Past Recurring' })]
    })

    const cards = columnFor(wrapper, '2026-11-08').findAll('.card')
    const lateCard = cards.find(c => c.get('.title').text() === 'Late')!
    const doneCard = cards.find(c => c.get('.title').text() === 'Done Late')!
    const recurringCard = cards.find(c => c.get('.title').text() === 'Past Recurring')!
    expect(lateCard.classes()).toContain('-overdue')
    expect(lateCard.get('.time').text()).toBe('overdue')
    expect(doneCard.classes()).not.toContain('-overdue')
    expect(recurringCard.classes()).not.toContain('-overdue')
  })

  it('orders timed Tasks by time, then any-time Tasks by creation',
    async () => {
      const { wrapper } = await mountWidget({
        planned: [
          task('2026-11-09', { created: at('2026-11-09', 10), title: 'Any Late' }),
          task('2026-11-09', { time: '10:00', title: 'Timed 10' }),
          task('2026-11-09', { created: at('2026-11-09', 8), title: 'Any Early' }),
          task('2026-11-09', { time: '08:00', title: 'Timed 08' })
        ]
      })

      const cards = columnFor(wrapper, '2026-11-09').findAll('.card')
      expect(cards.map(c => c.get('.title').text()))
        .toEqual(['Timed 08', 'Timed 10', 'Any Early', 'Any Late'])
    })

  it('opens the editor when a Task card is clicked', async () => {
    const { wrapper } = await mountWidget({
      planned: [task('2026-11-09', { title: 'Dentist' })]
    })

    await wrapper.get('.card').trigger('click')
    await flushPromises()

    const editor = document.querySelector('.task-editor')
    expect(editor).not.toBeNull()
    expect(
      (document.querySelector('.task-editor .input') as HTMLInputElement).value
    ).toBe('Dentist')
  })

  it('does not open the editor for an Occurrence card', async () => {
    const { wrapper } = await mountWidget({
      occurrences: [occurrence('2026-11-09', { title: 'Standup' })]
    })

    const card = wrapper.get('.card')
    expect(card.attributes('tabindex')).toBeUndefined()
    expect(card.attributes('role')).toBeUndefined()
    expect(card.attributes('aria-label')).toBeUndefined()

    await card.trigger('click')
    await flushPromises()

    expect(document.querySelector('.task-editor')).toBeNull()
  })

  it('shows a Monday-start week for en-GB', async () => {
    setLocaleOverride('en-GB')
    const { wrapper } = await mountWidget({
      planned: [task('2026-11-09')]
    })

    expect(wrapper.get('.actions .range').text()).toBe('9 – 15 Nov')
    expect(wrapper.findAll('.column').map(c => c.get('.day').text()))
      .toEqual(['9', '10', '11', '12', '13', '14', '15'])
  })

  it('reloads the week when the Selected Date moves', async () => {
    const { api } = await mountWidget()

    useSelectedDateStore().setDay(new Date(2026, 10, 2))
    await flushPromises()

    expect(api.tasks.list).toHaveBeenLastCalledWith({
      from: '2026-11-01', to: '2026-11-07'
    })
  })

  it('computes Overdue from real today, not the Selected Date',
    async () => {
      const { wrapper } = await mountWidget({
        planned: [task('2026-11-08', { title: 'Same day' })],
        selected: new Date(2026, 10, 8)
      })

      const col = columnFor(wrapper, '2026-11-08')
      expect(col.get('.card').classes()).toContain('-overdue')
    })

  it('reports a failed load', async () => {
    const api = stubBulletin()
    vi.mocked(api.tasks.list).mockResolvedValue({
      ok: false,
      error: { code: 'internal' }
    })
    vi.mocked(api.recurringTasks.listOccurrences).mockResolvedValue({
      ok: true,
      value: []
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    widget = mount(ThisWeekWidget, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(widget.get('[role="alert"]').text())
      .toBe('Couldn’t load This Week.')
  })
})
