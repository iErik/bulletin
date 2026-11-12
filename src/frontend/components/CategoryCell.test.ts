import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper }
  from '@vue/test-utils'
import type { Category } from '@shared/expenses'
import { useFixedToday } from '@/testing/clock'
import CategoryCell from './CategoryCell.vue'

const FOOD: Category = { id: 1, name: 'Food' }
const CATEGORIES: Category[] = [
  { id: 2, name: 'Transport' },
  FOOD,
  { id: 3, name: 'Bills' }
]

let cell: VueWrapper | undefined

/** Mounts it on Food and opens the popover. */
const mountOpen = async (): Promise<VueWrapper> => {
  cell = mount(CategoryCell, {
    attachTo: document.body,
    props: { category: FOOD, categories: CATEGORIES }
  })
  await cell.get('button').trigger('click')
  await flushPromises()
  return cell
}

const options = (wrapper: VueWrapper): string[] =>
  wrapper.findAll('[role="option"]').map(option =>
    option.text().replace(/\s+/g, ' '))

const highlighted = (wrapper: VueWrapper): string =>
  wrapper.get('[aria-selected="true"]').text()

const press = async (
  wrapper: VueWrapper,
  key: string
): Promise<void> => {
  await wrapper.get('.field').trigger('keydown', { key })
  await flushPromises()
}

describe('CategoryCell', () => {
  useFixedToday()

  afterEach(() => {
    cell?.unmount()
    cell = undefined
  })

  it('opens with the prompt and every chip, A to Z',
    async () => {
      const wrapper = await mountOpen()

      expect(wrapper.get('.prompt').text())
        .toBe('Select an option or create one:')
      expect(document.activeElement)
        .toBe(wrapper.get('.field').element)
      expect(options(wrapper))
        .toEqual(['Bills', 'Food', 'Transport'])
      expect(highlighted(wrapper)).toBe('Bills')
    })

  it('filters as you type', async () => {
    const wrapper = await mountOpen()

    await wrapper.get('.field').setValue('o')

    expect(options(wrapper))
      .toEqual(['Food', 'Transport', 'Create o'])
  })

  it('picks the highlighted chip on Enter', async () => {
    const wrapper = await mountOpen()

    await press(wrapper, 'ArrowDown')
    await press(wrapper, 'ArrowDown')
    expect(highlighted(wrapper)).toBe('Transport')
    await press(wrapper, 'Enter')

    expect(wrapper.emitted('choose')).toEqual([[
      { kind: 'pick', category: CATEGORIES[0] }
    ]])
    expect(wrapper.find('[role="dialog"]').exists())
      .toBe(false)
    expect(document.activeElement)
      .toBe(wrapper.get('button').element)
  })

  it('wraps the highlight around', async () => {
    const wrapper = await mountOpen()

    await press(wrapper, 'ArrowUp')

    expect(highlighted(wrapper)).toBe('Transport')
  })

  it('creates a name nothing matches', async () => {
    const wrapper = await mountOpen()

    await wrapper.get('.field').setValue('Gym')
    await press(wrapper, 'Enter')

    expect(wrapper.emitted('choose')).toEqual([[
      { kind: 'create', name: 'Gym' }
    ]])
  })

  it('picks a clicked chip', async () => {
    const wrapper = await mountOpen()

    await wrapper.findAll('[role="option"]')[2]
      .trigger('click')

    expect(wrapper.emitted('choose')).toEqual([[
      { kind: 'pick', category: CATEGORIES[0] }
    ]])
  })

  it('closes unchanged on Escape', async () => {
    const wrapper = await mountOpen()

    await press(wrapper, 'Escape')

    expect(wrapper.emitted('choose')).toBeUndefined()
    expect(wrapper.find('[role="dialog"]').exists())
      .toBe(false)
    expect(document.activeElement)
      .toBe(wrapper.get('button').element)
  })

  it('closes unchanged on a click outside', async () => {
    const wrapper = await mountOpen()

    await wrapper.get('.backdrop').trigger('pointerdown')

    expect(wrapper.emitted('choose')).toBeUndefined()
    expect(wrapper.find('[role="dialog"]').exists())
      .toBe(false)
  })

  it('names an empty chip', () => {
    cell = mount(CategoryCell, {
      props: { category: null, categories: CATEGORIES }
    })

    expect(cell.get('button').attributes('aria-label'))
      .toBe('Choose a Category')
  })
})
