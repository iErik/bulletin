import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'

describe('App', () => {
  it('shows the Dashboard on the root route', async () => {
    await router.push('/')
    await router.isReady()

    const app = mount(App, {
      global: { plugins: [createPinia(), router] }
    })

    expect(app.find('.title-bar').exists()).toBe(true)
    expect(app.get('.body > .sidebar').text()).toBe('')
    expect(
      app.find('.body > .page > .dashboard-view')
        .exists()
    ).toBe(true)
  })
})
