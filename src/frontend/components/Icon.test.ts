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

  it('is hidden from readers without a title', () => {
    const icon = mount(Icon, { props: { name: 'bullet' } })

    const svg = icon.get('svg')
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('role')).toBeUndefined()
    expect(svg.attributes('aria-label')).toBeUndefined()
  })

  it('is a named image with a title', () => {
    const icon = mount(Icon, {
      props: { name: 'bullet', title: 'Bullet' }
    })

    const svg = icon.get('svg')
    expect(svg.attributes('role')).toBe('img')
    expect(svg.attributes('aria-label')).toBe('Bullet')
    expect(svg.attributes('aria-hidden')).toBeUndefined()
  })

  it('renders nothing for an unknown name', () => {
    const icon = mount(Icon, { props: { name: 'nope' } })

    expect(icon.find('svg').exists()).toBe(false)
  })
})
