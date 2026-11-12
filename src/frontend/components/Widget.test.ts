import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Icon from './Icon.vue'
import Widget from './Widget.vue'

describe('Widget', () => {
  it('shows its title and its body', () => {
    const widget = mount(Widget, {
      props: { title: 'Sleep', icon: 'moon' },
      slots: { default: '<p class="nights">7</p>' }
    })

    expect(widget.get('h2').text()).toBe('Sleep')
    expect(widget.get('.body > .nights').text())
      .toBe('7')
  })

  it('puts its icon in a tile before the title', () => {
    const widget = mount(Widget, {
      props: { title: 'Sleep', icon: 'moon' }
    })

    const tile = widget.get('.header > .tile')
    expect(tile.findComponent(Icon).props('name'))
      .toBe('moon')
    expect(tile.element.nextElementSibling?.tagName)
      .toBe('H2')
  })

  it('puts actions in its header', () => {
    const widget = mount(Widget, {
      props: { title: 'Mood', icon: 'mood' },
      slots: { actions: '<button>Save</button>' }
    })

    expect(widget.get('.header > .actions > button')
      .text()).toBe('Save')
  })

  it('has no actions without the slot', () => {
    const widget = mount(Widget, {
      props: { title: 'Mood', icon: 'mood' }
    })

    expect(widget.find('.actions').exists()).toBe(false)
  })

  it('has an empty body without a slot', () => {
    const widget = mount(Widget, {
      props: { title: 'Mood', icon: 'mood' }
    })

    expect(widget.get('.body').element.children)
      .toHaveLength(0)
  })
})
