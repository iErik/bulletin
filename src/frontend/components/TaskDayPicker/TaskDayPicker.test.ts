import { describe, expect, it } from 'vitest'
import {
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import type { LocalDate } from '@shared/storage'
import { today, useFixedToday } from '@/testing/clock'
import TaskDayPicker from './TaskDayPicker.vue'

// Today is 2026-11-09 (Monday); tomorrow is 2026-11-10.
const mountPicker = (
  modelValue: LocalDate | null,
  someday = true
): VueWrapper => {
  const wrapper: VueWrapper = mount(TaskDayPicker, {
    props: {
      modelValue,
      today,
      someday,
      'onUpdate:modelValue': async (
        next: LocalDate | null
      ) => {
        await wrapper.setProps({ modelValue: next })
      }
    }
  })
  return wrapper
}

const chip = (
  wrapper: VueWrapper,
  text: string
): DOMWrapper<HTMLButtonElement> =>
  wrapper.findAll<HTMLButtonElement>('button')
    .find(b => b.text().trim() === text)!

describe('TaskDayPicker', () => {
  useFixedToday()

  it('switches between Today, Tomorrow and Someday',
    async () => {
      const wrapper = mountPicker('2026-11-09')

      expect(chip(wrapper, 'Today').classes())
        .toContain('-active')
      expect(wrapper.find('.date-picker').exists()).toBe(false)

      await chip(wrapper, 'Tomorrow').trigger('click')
      expect(wrapper.emitted('update:modelValue')?.at(-1))
        .toEqual(['2026-11-10'])
      expect(chip(wrapper, 'Tomorrow').classes())
        .toContain('-active')

      await chip(wrapper, 'Someday').trigger('click')
      expect(wrapper.emitted('update:modelValue')?.at(-1))
        .toEqual([null])
      expect(chip(wrapper, 'Someday').classes())
        .toContain('-active')
    })

  it('opens DatePicker for past/custom dates and formats chip',
    async () => {
      const wrapper = mountPicker('2026-11-05')

      expect(wrapper.find('.date-picker').exists()).toBe(true)
      expect(wrapper.get('.chip.-date').text()).toBe('Thu 5')
      expect(wrapper.get('.chip.-date').classes())
        .toContain('-active')

      await wrapper.get('select[aria-label="Day"]')
        .setValue('28')
      expect(wrapper.emitted('update:modelValue')?.at(-1))
        .toEqual(['2026-11-28'])
      expect(wrapper.get('.chip.-date').text()).toBe('Sat 28')

      await chip(wrapper, 'Today').trigger('click')
      expect(wrapper.find('.date-picker').exists()).toBe(false)
      expect(wrapper.emitted('layout')).toHaveLength(1)
    })

  it('opens DatePicker from Someday defaulting to today',
    async () => {
      const wrapper = mountPicker(null)

      await wrapper.get('.chip.-date').trigger('click')
      expect(wrapper.emitted('update:modelValue')?.at(-1))
        .toEqual(['2026-11-09'])
      expect(wrapper.find('.date-picker').exists()).toBe(true)
      expect(wrapper.emitted('layout')).toHaveLength(1)
    })

  it('hides Someday when someday is false', () => {
    const wrapper = mountPicker('2026-11-09', false)

    expect(wrapper.text()).not.toContain('Someday')
    expect(wrapper.findAll('button')).toHaveLength(3)
  })
})
