import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PlaceholderView from './PlaceholderView.vue'

describe('PlaceholderView', () => {
  it('shows the Page name and "Coming soon"', () => {
    const view = mount(PlaceholderView, {
      props: { page: 'Sleep' }
    })

    expect(view.get('h1').text()).toBe('Sleep')
    expect(view.get('.note').text()).toBe('Coming soon')
  })
})
