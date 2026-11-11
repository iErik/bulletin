import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'

const mountAt = async (
  path: string
): Promise<VueWrapper> => {
  await router.push(path)
  await router.isReady()
  return mount(App, {
    global: { plugins: [createPinia(), router] }
  })
}

describe('App', () => {
  it('shows the Dashboard on the root route', async () => {
    const app = await mountAt('/')

    expect(app.find('.title-bar').exists()).toBe(true)
    expect(
      app.find('.body > .page > .dashboard-view')
        .exists()
    ).toBe(true)
  })

  it('puts the Sidebar in its region', async () => {
    const app = await mountAt('/')

    expect(
      app.find('.body > .sidebar > .app-sidebar').exists()
    ).toBe(true)
  })

  it.each([
    ['/sleep', 'Sleep'],
    ['/mood', 'Mood'],
    ['/tasks', 'Tasks'],
    ['/expenses', 'Expenses'],
    ['/notes', 'Notes']
  ])('shows a placeholder on %s', async (path, label) => {
    const app = await mountAt(path)

    const view = app.get('.page > .placeholder-view')
    expect(view.get('h1').text()).toBe(label)
    expect(view.text()).toContain('Coming soon')
  })
})
