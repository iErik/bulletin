import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Icon from './Icon.vue'

describe('Icon', () => {
  it('renders the named SVG in currentColor', () => {
    const icon = mount(Icon, { props: { name: 'bullet' } })

    const svg = icon.get('svg')
    expect(svg.classes()).toContain('app-icon')
    expect(svg.attributes('stroke')).toBe('currentColor')
  })

  it('renders nothing for an unknown name', () => {
    const icon = mount(Icon, { props: { name: 'nope' } })

    expect(icon.find('svg').exists()).toBe(false)
  })
})
