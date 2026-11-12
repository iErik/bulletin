import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper }
  from '@vue/test-utils'
import HabitIconPicker from './HabitIconPicker.vue'

let picker: VueWrapper | undefined

const mountPicker = async (): Promise<VueWrapper> => {
  picker = mount(HabitIconPicker, {
    attachTo: document.body,
    props: { modelValue: 'reading' }
  })
  await picker.get('.toggle').trigger('click')
  await flushPromises()
  return picker
}

const focusedLabel = (): string | null | undefined =>
  document.activeElement?.getAttribute('aria-label')

describe('HabitIconPicker', () => {
  afterEach(() => {
    picker?.unmount()
    picker = undefined
  })

  it('opens on the chosen icon', async () => {
    const wrapper = await mountPicker()

    expect(wrapper.findAll('[role="radio"]'))
      .toHaveLength(24)
    expect(wrapper.get('[aria-checked="true"]')
      .attributes('aria-label')).toBe('reading')
    expect(focusedLabel()).toBe('reading')
  })

  it('moves with the arrow keys', async () => {
    const wrapper = await mountPicker()
    const press = (key: string): Promise<void> =>
      wrapper.get('.option:focus')
        .trigger('keydown', { key })

    await press('ArrowRight')
    expect(focusedLabel()).toBe('water')
    await press('ArrowDown')
    expect(focusedLabel()).toBe('cleaning')
    await press('ArrowUp')
    await press('ArrowLeft')
    expect(focusedLabel()).toBe('reading')
    await press('End')
    expect(focusedLabel()).toBe('screen free')
  })

  it('chooses an icon and closes', async () => {
    const wrapper = await mountPicker()

    await wrapper.get('[aria-label="water"]')
      .trigger('click')

    expect(wrapper.emitted('update:modelValue'))
      .toEqual([['water']])
    expect(wrapper.find('.grid').exists()).toBe(false)
    expect(document.activeElement)
      .toBe(wrapper.get('.toggle').element)
  })

  it('closes alone on Escape', async () => {
    const wrapper = await mountPicker()
    const outer = vi.fn()
    document.body.addEventListener('keydown', outer)

    await wrapper.get('.option:focus')
      .trigger('keydown', { key: 'Escape' })
    document.body.removeEventListener('keydown', outer)

    expect(wrapper.find('.grid').exists()).toBe(false)
    expect(outer).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue'))
      .toBeUndefined()
  })
})
