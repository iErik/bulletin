import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Widget from './Widget.vue'

describe('Widget', () => {
  it('shows its title and its body', () => {
    const widget = mount(Widget, {
      props: { title: 'Sleep' },
      slots: { default: '<p class="nights">7</p>' }
    })

    expect(widget.get('h2').text()).toBe('Sleep')
    expect(widget.get('.body > .nights').text())
      .toBe('7')
  })

  it('has an empty body without a slot', () => {
    const widget = mount(Widget, {
      props: { title: 'Mood' }
    })

    expect(widget.get('.body').element.children)
      .toHaveLength(0)
  })
})
