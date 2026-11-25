import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskCheckbox from './TaskCheckbox.vue'

describe('TaskCheckbox', () => {
  it('toggles modelValue and reflects checked state',
    async () => {
      const wrapper = mount(TaskCheckbox, {
        props: {
          modelValue: false,
          'onUpdate:modelValue': (v: boolean) =>
            wrapper.setProps({ modelValue: v })
        },
        slots: { default: 'Done' }
      })

      expect(wrapper.text()).toBe('Done')
      expect(wrapper.get('.box').classes())
        .not.toContain('-checked')
      expect(wrapper.find('.app-icon').exists()).toBe(false)

      await wrapper.get('input').setValue(true)
      expect(wrapper.emitted('update:modelValue'))
        .toEqual([[true]])
      expect(wrapper.get('.box').classes())
        .toContain('-checked')
      expect(wrapper.find('.app-icon').exists()).toBe(true)
    })

  it('forwards aria-label and disabled for standalone use',
    () => {
      const wrapper = mount(TaskCheckbox, {
        props: {
          modelValue: true,
          label: 'Mark Dentist done',
          disabled: true
        }
      })
      const input = wrapper.get('input')
        .element as HTMLInputElement

      expect(input.getAttribute('aria-label'))
        .toBe('Mark Dentist done')
      expect(input.disabled).toBe(true)
      expect(wrapper.get('.box').classes())
        .toContain('-checked')
    })
})
