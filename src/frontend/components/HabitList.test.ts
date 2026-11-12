import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import type { BulletinApi } from '@shared/bridge'
import type { Habit } from '@shared/habits'
import { stubBulletin } from '@/testing/bulletin'
import HabitList from './HabitList.vue'

let list: VueWrapper | undefined

const habit = (id: number, name: string): Habit =>
  ({
    id,
    name,
    icon: 'reading',
    created: '2026-01-01',
    archived: false
  })

const HABITS = [
  habit(1, 'Reading'),
  habit(2, 'Running'),
  habit(3, 'Water')
]

const mountList = (
  habits: Habit[] = HABITS
): { wrapper: VueWrapper; api: BulletinApi } => {
  const api = stubBulletin()
  list = mount(HabitList, {
    attachTo: document.body,
    props: {
      habits,
      current: 2,
      done: (one: Habit) => one.id * 4,
      days: 30
    }
  })
  return { wrapper: list, api }
}

const row = (
  wrapper: VueWrapper,
  name: string
): DOMWrapper<HTMLLIElement> =>
  wrapper.findAll<HTMLLIElement>('.row')
    .find(item => item.get('.name').text() === name)!

const choose = (
  wrapper: VueWrapper,
  name: string
): DOMWrapper<HTMLButtonElement> =>
  row(wrapper, name).find<HTMLButtonElement>('.choose')

const button = (
  wrapper: VueWrapper,
  label: string
): DOMWrapper<HTMLButtonElement> =>
  wrapper.find<HTMLButtonElement>(
    `button[aria-label="${label}"]`
  )

const focusedName = (): string | undefined =>
  document.activeElement?.closest('.row')
    ?.querySelector('.name')?.textContent ?? undefined

describe('HabitList', () => {
  afterEach(() => {
    list?.unmount()
    list = undefined
    document.body.innerHTML = ''
  })

  it('shows each Habit with its icon and count', () => {
    const { wrapper } = mountList()

    const rows = wrapper.findAll('.row')
    expect(rows.map(item => item.get('.name').text()))
      .toEqual(['Reading', 'Running', 'Water'])
    expect(rows[0].get('.count').text())
      .toBe('4 / 30 days')
    expect(rows[0].find('svg.icon').exists()).toBe(true)
  })

  it('marks and focuses the current Habit', () => {
    const { wrapper } = mountList()

    expect(choose(wrapper, 'Running')
      .attributes('aria-current')).toBe('true')
    expect(row(wrapper, 'Running').classes())
      .toContain('-current')
    expect(row(wrapper, 'Reading').find('.-check').exists())
      .toBe(false)
    expect(focusedName()).toBe('Running')
  })

  it('chooses a Habit on click', async () => {
    const { wrapper } = mountList()

    await choose(wrapper, 'Water').trigger('click')

    expect(wrapper.emitted('choose')).toEqual([[HABITS[2]]])
  })

  it('moves between rows with the arrow keys',
    async () => {
      const { wrapper } = mountList()
      const press = (key: string): Promise<void> =>
        wrapper.get('.choose:focus').trigger('keydown', {
          key
        })

      await press('ArrowDown')
      expect(focusedName()).toBe('Water')
      await press('ArrowDown')
      expect(focusedName()).toBe('Water')
      await press('Home')
      expect(focusedName()).toBe('Reading')
      await press('ArrowUp')
      expect(focusedName()).toBe('Reading')
      await press('End')
      expect(focusedName()).toBe('Water')
      expect(choose(wrapper, 'Water')
        .attributes('tabindex')).toBe('0')
      expect(button(wrapper, 'Delete Water')
        .attributes('tabindex')).toBe('0')
      expect(choose(wrapper, 'Running')
        .attributes('tabindex')).toBe('-1')
    })

  it('asks before deleting', async () => {
    const { wrapper, api } = mountList()

    await button(wrapper, 'Delete Reading').trigger('click')
    await flushPromises()

    expect(row(wrapper, 'Reading').text())
      .toContain('Delete?')
    expect(document.activeElement)
      .toBe(button(wrapper, 'Delete').element)
    expect(api.habits.archive).not.toHaveBeenCalled()
  })

  it('archives on ✓', async () => {
    const { wrapper, api } = mountList()

    await button(wrapper, 'Delete Reading').trigger('click')
    await button(wrapper, 'Delete').trigger('click')
    await flushPromises()

    expect(api.habits.archive).toHaveBeenCalledWith(1)
    expect(wrapper.emitted('archived'))
      .toEqual([[HABITS[0]]])
  })

  it('keeps asking when archiving fails', async () => {
    const { wrapper, api } = mountList()
    vi.mocked(api.habits.archive).mockResolvedValue({
      ok: false,
      error: { code: 'internal' }
    })

    await button(wrapper, 'Delete Reading').trigger('click')
    await button(wrapper, 'Delete').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text())
      .toBe('Couldn’t delete the Habit. Try again.')
    expect(wrapper.text()).toContain('Delete?')
    expect(document.activeElement)
      .toBe(button(wrapper, 'Delete').element)
    expect(wrapper.emitted('archived')).toBeUndefined()
  })

  it.each([
    ['×', async (wrapper: VueWrapper) => {
      await button(wrapper, 'Don’t delete')
        .trigger('click')
    }],
    ['Escape', async (wrapper: VueWrapper) => {
      await button(wrapper, 'Delete')
        .trigger('keydown', { key: 'Escape' })
    }],
    ['focus elsewhere', async (wrapper: VueWrapper) => {
      choose(wrapper, 'Water').element.focus()
      await flushPromises()
    }],
    ['a click elsewhere', async () => {
      document.body.dispatchEvent(
        new Event('pointerdown', { bubbles: true }))
      await flushPromises()
    }]
  ])('cancels on %s', async (_, cancel) => {
    const { wrapper, api } = mountList()

    await button(wrapper, 'Delete Reading').trigger('click')
    await flushPromises()
    await cancel(wrapper)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Delete?')
    expect(api.habits.archive).not.toHaveBeenCalled()
  })

  it('asks for one row at a time', async () => {
    const { wrapper } = mountList()

    await button(wrapper, 'Delete Reading').trigger('click')
    await flushPromises()
    await button(wrapper, 'Delete Water').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.question')).toHaveLength(1)
    expect(row(wrapper, 'Water').text())
      .toContain('Delete?')
  })

  it('edits a row in place', async () => {
    const { wrapper, api } = mountList()

    await button(wrapper, 'Edit Water').trigger('click')
    await flushPromises()
    const input = wrapper.get<HTMLInputElement>('input')
    expect(input.element.value).toBe('Water')
    expect(document.activeElement).toBe(input.element)
    await input.setValue('Tea')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(api.habits.update).toHaveBeenCalledWith({
      id: 3,
      name: 'Tea',
      icon: 'reading'
    })
    expect(wrapper.emitted('updated')?.[0])
      .toEqual([expect.objectContaining({ name: 'Tea' })])
    expect(wrapper.find('form').exists()).toBe(false)
    expect(focusedName()).toBe('Water')
  })

  it('edits or asks for one row at a time', async () => {
    const { wrapper } = mountList()

    await button(wrapper, 'Delete Reading').trigger('click')
    await button(wrapper, 'Edit Water').trigger('click')
    await flushPromises()
    expect(wrapper.find('.question').exists()).toBe(false)
    expect(wrapper.findAll('form')).toHaveLength(1)

    await button(wrapper, 'Delete Reading').trigger('click')
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.findAll('.question')).toHaveLength(1)
  })
})
