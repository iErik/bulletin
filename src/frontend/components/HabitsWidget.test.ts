import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BulletinApi } from '@shared/bridge'
import type { Habit, HabitEntry } from '@shared/habits'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { CURRENT_HABIT_KEY } from '@/habits/current-habit'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import DateHeader from './DateHeader.vue'
import HabitsWidget from './HabitsWidget.vue'

let widget: VueWrapper | undefined

const habit = (
  id: number,
  name: string,
  created = '2026-01-01'
): Habit =>
  ({ id, name, icon: 'reading', created, archived: false })

const HABITS = [
  habit(1, 'Reading'),
  habit(2, 'Running', '2026-11-04')
]

const ENTRIES: HabitEntry[] = [
  { habitId: 1, date: '2026-11-03' },
  { habitId: 2, date: '2026-11-05' }
]

/** Mounts it on November with HABITS and ENTRIES. */
const mountWidget = async (
  habits: Habit[] = HABITS
): Promise<{ wrapper: VueWrapper; api: BulletinApi }> => {
  const api = stubBulletin()
  vi.mocked(api.habits.list)
    .mockResolvedValue({ ok: true, value: habits })
  vi.mocked(api.habits.listEntries)
    .mockResolvedValue({ ok: true, value: ENTRIES })
  const pinia = createPinia()
  setActivePinia(pinia)
  widget = mount(HabitsWidget, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper: widget, api }
}

const pill = (
  wrapper: VueWrapper,
  day: number
): DOMWrapper<HTMLButtonElement> =>
  wrapper.findAll<HTMLButtonElement>('.pill')[day - 1]

const label = (
  wrapper: VueWrapper,
  day: number
): string | undefined =>
  pill(wrapper, day).attributes('aria-label')

const name = (wrapper: VueWrapper): string =>
  wrapper.get('.actions > .name').text()

const nameButton = (
  wrapper: VueWrapper
): DOMWrapper<HTMLButtonElement> =>
  wrapper.find<HTMLButtonElement>('.actions > .name')

const rowNames = (wrapper: VueWrapper): string[] =>
  wrapper.findAll('.row:not(.-new) .name')
    .map(item => item.text())

/** Opens the Habit list and returns its Habits' rows. */
const openList = async (
  wrapper: VueWrapper
): Promise<DOMWrapper<HTMLLIElement>[]> => {
  await nameButton(wrapper).trigger('click')
  await flushPromises()
  return wrapper.findAll<HTMLLIElement>(
    '.row:not(.-new)'
  )
}

/** Creates `named` from the open list's last row. */
const createFromList = async (
  wrapper: VueWrapper,
  named: string
): Promise<void> => {
  await wrapper.get('.-new > .choose').trigger('click')
  await wrapper.get('input').setValue(named)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

const archiveRow = async (
  row: DOMWrapper<HTMLLIElement>
): Promise<void> => {
  await row.get('[aria-label^="Delete "]')
    .trigger('click')
  await row.get('.-confirm').trigger('click')
  await flushPromises()
}

const failWith = {
  ok: false,
  error: { code: 'internal' }
} as const

// Today is November 9th, 2026. Months are 0-based.
describe('HabitsWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('loads active Habits and the month’s Entries',
    async () => {
      const { api } = await mountWidget()

      expect(api.habits.list).toHaveBeenCalledWith('active')
      expect(api.habits.listEntries).toHaveBeenCalledWith({
        from: '2026-11-01',
        to: '2026-11-30'
      })
    })

  it('shows the oldest Habit by default', async () => {
    const { wrapper } = await mountWidget()

    expect(name(wrapper)).toBe('Reading')
    expect(label(wrapper, 3)).toBe('Nov 3 · Done')
    expect(pill(wrapper, 3).classes()).toContain('-filled')
    expect(label(wrapper, 5)).toBe('Nov 5 · Not done')
    expect(pill(wrapper, 5).classes())
      .not.toContain('-filled')
  })

  it('shows the remembered Habit', async () => {
    localStorage.setItem(CURRENT_HABIT_KEY, '2')
    const { wrapper } = await mountWidget()

    expect(name(wrapper)).toBe('Running')
    expect(label(wrapper, 5)).toBe('Nov 5 · Done')
    expect(label(wrapper, 3)).toBe('Nov 3 · Not done')
  })

  it('falls back to the oldest when it’s gone',
    async () => {
      localStorage.setItem(CURRENT_HABIT_KEY, '9')
      const { wrapper } = await mountWidget()

      expect(name(wrapper)).toBe('Reading')
      expect(localStorage.getItem(CURRENT_HABIT_KEY))
        .toBe('1')
    })

  it('disables days before the Habit was created',
    async () => {
      localStorage.setItem(CURRENT_HABIT_KEY, '2')
      const { wrapper, api } = await mountWidget()

      await pill(wrapper, 3).trigger('click')

      expect(pill(wrapper, 3).attributes('aria-disabled'))
        .toBe('true')
      expect(pill(wrapper, 4).attributes('aria-disabled'))
        .toBeUndefined()
      expect(pill(wrapper, 10).attributes('aria-disabled'))
        .toBe('true')
      expect(api.habits.createEntry).not.toHaveBeenCalled()
    })

  it('marks a day done at once', async () => {
    const { wrapper, api } = await mountWidget()

    await pill(wrapper, 4).trigger('click')

    expect(label(wrapper, 4)).toBe('Nov 4 · Done')
    expect(api.habits.createEntry).toHaveBeenCalledWith({
      habitId: 1,
      date: '2026-11-04'
    })
  })

  it('marks a done day not done', async () => {
    const { wrapper, api } = await mountWidget()

    await pill(wrapper, 3).trigger('click')
    await flushPromises()

    expect(label(wrapper, 3)).toBe('Nov 3 · Not done')
    expect(api.habits.deleteEntry).toHaveBeenCalledWith({
      habitId: 1,
      date: '2026-11-03'
    })
    expect(wrapper.find('[role="alert"]').exists())
      .toBe(false)
  })

  it('reverts a failed save and says so', async () => {
    const { wrapper, api } = await mountWidget()
    vi.mocked(api.habits.createEntry)
      .mockResolvedValue(failWith)

    await pill(wrapper, 4).trigger('click')
    await flushPromises()

    expect(label(wrapper, 4)).toBe('Nov 4 · Not done')
    expect(wrapper.get('[role="alert"]').text())
      .toBe('Couldn’t save that day. Try again.')
  })

  it('ignores a day while it’s saving', async () => {
    const { wrapper, api } = await mountWidget()
    vi.mocked(api.habits.createEntry)
      .mockReturnValue(new Promise(() => {}))

    await pill(wrapper, 4).trigger('click')
    await pill(wrapper, 4).trigger('click')

    expect(label(wrapper, 4)).toBe('Nov 4 · Done')
    expect(api.habits.deleteEntry).not.toHaveBeenCalled()
  })

  it('reloads Entries for another month', async () => {
    const { wrapper, api } = await mountWidget()
    vi.mocked(api.habits.listEntries).mockResolvedValue({
      ok: true,
      value: [{ habitId: 1, date: '2026-10-31' }]
    })

    useSelectedDateStore().setDay(new Date(2026, 9, 15))
    await flushPromises()

    expect(api.habits.listEntries).toHaveBeenLastCalledWith({
      from: '2026-10-01',
      to: '2026-10-31'
    })
    expect(label(wrapper, 31)).toBe('Oct 31 · Done')
  })

  it('ignores days till the month loads', async () => {
    const api = stubBulletin()
    vi.mocked(api.habits.list)
      .mockResolvedValue({ ok: true, value: HABITS })
    vi.mocked(api.habits.listEntries)
      .mockReturnValue(new Promise(() => {}))
    const pinia = createPinia()
    setActivePinia(pinia)
    widget = mount(HabitsWidget, {
      attachTo: document.body,
      global: { plugins: [pinia] }
    })
    await flushPromises()

    await pill(widget, 4).trigger('click')

    expect(label(widget, 4)).toBe('Nov 4 · Not done')
    expect(api.habits.createEntry).not.toHaveBeenCalled()
  })

  it('keeps a day being saved through a reload',
    async () => {
      const { wrapper, api } = await mountWidget()
      let saved = (): void => {}
      vi.mocked(api.habits.createEntry).mockReturnValue(
        new Promise(resolve => {
          saved = () => resolve({ ok: true, value: {
            habitId: 1, date: '2026-11-04'
          } })
        }))
      const store = useSelectedDateStore()

      await pill(wrapper, 4).trigger('click')
      store.setDay(new Date(2026, 9, 15))
      await flushPromises()
      store.setDay(new Date(2026, 10, 9))
      await flushPromises()
      expect(label(wrapper, 4)).toBe('Nov 4 · Done')

      saved()
      await flushPromises()
      expect(label(wrapper, 4)).toBe('Nov 4 · Done')
    })

  it('shows the month again after a failed load',
    async () => {
      const { wrapper, api } = await mountWidget()
      const store = useSelectedDateStore()
      vi.mocked(api.habits.listEntries)
        .mockResolvedValueOnce(failWith)

      store.setDay(new Date(2026, 9, 15))
      await flushPromises()
      expect(wrapper.get('[role="alert"]').text())
        .toBe('Couldn’t load this month.')

      store.setDay(new Date(2026, 10, 9))
      await flushPromises()
      expect(wrapper.find('[role="alert"]').exists())
        .toBe(false)
      expect(label(wrapper, 3)).toBe('Nov 3 · Done')
    })

  it('shows the empty state without Habits', async () => {
    const { wrapper } = await mountWidget([])

    expect(wrapper.text()).toContain('No habits yet')
    expect(wrapper.find('.actions').exists()).toBe(false)
    expect(wrapper.find('.month-grid').exists()).toBe(false)
  })

  it('opens the list from the name', async () => {
    const { wrapper } = await mountWidget()

    const rows = await openList(wrapper)

    expect(nameButton(wrapper).attributes('aria-expanded'))
      .toBe('true')
    expect(wrapper.find('.month-grid').exists()).toBe(false)
    expect(rows.map(row => row.get('.count').text()))
      .toEqual(['1 / 30 days', '1 / 30 days'])
  })

  it('switches Habit and closes the list', async () => {
    const { wrapper } = await mountWidget()
    const rows = await openList(wrapper)

    await rows[1].get('.choose').trigger('click')
    await flushPromises()

    expect(name(wrapper)).toBe('Running')
    expect(localStorage.getItem(CURRENT_HABIT_KEY))
      .toBe('2')
    expect(label(wrapper, 5)).toBe('Nov 5 · Done')
    expect(document.activeElement)
      .toBe(nameButton(wrapper).element)
  })

  it.each([
    ['the name', async (wrapper: VueWrapper) => {
      await nameButton(wrapper).trigger('click')
    }],
    ['Escape', async (wrapper: VueWrapper) => {
      await wrapper.get('.choose')
        .trigger('keydown', { key: 'Escape' })
    }],
    ['a click outside', async () => {
      document.body.click()
    }]
  ])('closes the list on %s', async (_, close) => {
    const { wrapper } = await mountWidget()
    await openList(wrapper)

    await close(wrapper)
    await flushPromises()

    expect(wrapper.find('.habit-list').exists())
      .toBe(false)
    expect(nameButton(wrapper).attributes('aria-expanded'))
      .toBe('false')
    expect(document.activeElement)
      .toBe(nameButton(wrapper).element)
  })

  it('switches to the oldest when the current one goes',
    async () => {
      localStorage.setItem(CURRENT_HABIT_KEY, '2')
      const { wrapper, api } = await mountWidget()
      const rows = await openList(wrapper)

      await archiveRow(rows[1])

      expect(api.habits.archive).toHaveBeenCalledWith(2)
      expect(rowNames(wrapper)).toEqual(['Reading'])
      expect(name(wrapper)).toBe('Reading')
      expect(localStorage.getItem(CURRENT_HABIT_KEY))
        .toBe('1')
    })

  it('shows the empty state when the last one goes',
    async () => {
      const { wrapper } = await mountWidget([HABITS[0]])
      const rows = await openList(wrapper)

      await archiveRow(rows[0])

      expect(wrapper.text()).toContain('No habits yet')
      expect(wrapper.find('.actions').exists()).toBe(false)
    })

  it('says when the Habits can’t load', async () => {
    const api = stubBulletin()
    vi.mocked(api.habits.list).mockResolvedValue(failWith)
    const pinia = createPinia()
    setActivePinia(pinia)
    widget = mount(HabitsWidget, {
      attachTo: document.body,
      global: { plugins: [pinia] }
    })
    await flushPromises()

    expect(widget.get('[role="alert"]').text())
      .toBe('Couldn’t load the Habits.')
  })

  it('renames the current Habit, open till saved',
    async () => {
      const { wrapper, api } = await mountWidget()
      let saved = (): void => {}
      vi.mocked(api.habits.update).mockReturnValue(
        new Promise(resolve => {
          saved = () => resolve({ ok: true, value: {
            ...HABITS[0], name: 'Books'
          } })
        }))
      const rows = await openList(wrapper)

      await rows[0].get('[aria-label="Edit Reading"]')
        .trigger('click')
      await wrapper.get('input').setValue('Books')
      await wrapper.get('form').trigger('submit')
      await nameButton(wrapper).trigger('click')
      document.body.click()
      await flushPromises()
      expect(wrapper.find('.habit-list').exists())
        .toBe(true)

      saved()
      await flushPromises()
      expect(name(wrapper)).toBe('Books')
      expect(rowNames(wrapper))
        .toEqual(['Books', 'Running'])
    })

  it('creates the first Habit from the empty state',
    async () => {
      const { wrapper, api } = await mountWidget([])

      await wrapper.get('.track').trigger('click')
      await flushPromises()
      const input = wrapper.get('input')
      expect(document.activeElement).toBe(input.element)
      await input.setValue('Yoga')
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      expect(api.habits.create).toHaveBeenCalled()
      expect(name(wrapper)).toBe('Yoga')
      expect(wrapper.find('.habit-list').exists())
        .toBe(true)
    })

  it('adds a Habit without making it current',
    async () => {
      const { wrapper, api } = await mountWidget()
      vi.mocked(api.habits.create).mockResolvedValue({
        ok: true,
        value: habit(3, 'Yoga', '2026-11-09')
      })
      await openList(wrapper)

      await createFromList(wrapper, 'Yoga')

      expect(rowNames(wrapper))
        .toEqual(['Reading', 'Running', 'Yoga'])
      expect(name(wrapper)).toBe('Reading')
      expect(localStorage.getItem(CURRENT_HABIT_KEY))
        .toBe('1')
    })

  it('puts a restored Habit back in its place',
    async () => {
      const { wrapper, api } = await mountWidget()
      vi.mocked(api.habits.create).mockResolvedValue({
        ok: true,
        value: habit(3, 'Water', '2026-02-01')
      })
      await openList(wrapper)

      await createFromList(wrapper, 'water')

      expect(api.habits.create).toHaveBeenCalledWith({
        name: 'water',
        icon: 'meditation'
      })
      expect(rowNames(wrapper))
        .toEqual(['Reading', 'Water', 'Running'])
    })

  it('keeps the date on ← in the editor', async () => {
    const { wrapper } = await mountWidget()
    const header = mount(DateHeader)
    const rows = await openList(wrapper)

    await rows[0].get('[aria-label="Edit Reading"]')
      .trigger('click')
    await wrapper.get('[aria-label="Save"]')
      .trigger('keydown', { key: 'ArrowLeft' })
    header.unmount()

    expect(useSelectedDateStore().day)
      .toEqual(new Date(2026, 10, 9))
  })
})
