import { afterEach, describe, expect, it } from 'vitest'
import {
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
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

const mountList = (): VueWrapper => {
  stubBulletin()
  list = mount(HabitList, {
    attachTo: document.body,
    props: {
      habits: HABITS,
      current: 2,
      done: (one: Habit) => one.id * 4,
      days: 30
    }
  })
  return list
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
    const wrapper = mountList()

    const rows = wrapper.findAll('.row')
    expect(rows.map(item => item.get('.name').text()))
      .toEqual(['Reading', 'Running', 'Water'])
    expect(rows[0].get('.count').text())
      .toBe('4 / 30 days')
    expect(rows[0].find('svg.icon').exists()).toBe(true)
  })

  it('marks and focuses the current Habit', () => {
    const wrapper = mountList()

    expect(choose(wrapper, 'Running')
      .attributes('aria-current')).toBe('true')
    expect(row(wrapper, 'Running').classes())
      .toContain('-current')
    expect(row(wrapper, 'Reading').find('.-check').exists())
      .toBe(false)
    expect(focusedName()).toBe('Running')
  })

  it('chooses a Habit on click', async () => {
    const wrapper = mountList()

    await choose(wrapper, 'Water').trigger('click')

    expect(wrapper.emitted('choose')).toEqual([[HABITS[2]]])
  })

  it('moves between rows with the arrow keys',
    async () => {
      const wrapper = mountList()
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
      expect(choose(wrapper, 'Running')
        .attributes('tabindex')).toBe('-1')
    })
})
