import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import HomeView from './HomeView.vue'

describe('HomeView', () => {
  it('shows the platform from the preload API', () => {
    vi.stubGlobal('bulletin', { platform: 'testos' })

    const view = mount(HomeView, {
      global: { plugins: [createPinia()] }
    })

    expect(view.get('[data-test="platform"]').text())
      .toBe('testos')
  })
})
