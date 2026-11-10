import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import DashboardView from './DashboardView.vue'

let dashboard: VueWrapper | undefined

// Stands in for the Title Bar the header goes into.
const mountDashboard = () => {
  const bar = document.createElement('div')
  bar.id = 'title-bar-content'
  document.body.append(bar)
  return dashboard = mount(DashboardView, {
    attachTo: document.body,
    global: { plugins: [createPinia()] }
  })
}

describe('DashboardView', () => {
  afterEach(() => {
    dashboard?.unmount()
    dashboard = undefined
    document.body.innerHTML = ''
  })

  it('puts the date header in the Title Bar', () => {
    mountDashboard()

    expect(
      document.querySelector(
        '#title-bar-content > .date-header'
      )
    ).not.toBeNull()
  })

  it.each([
    ['sleep', 'Sleep'],
    ['expenses', 'Expenses'],
    ['mood', 'Mood'],
    ['habits', 'Habits'],
    ['weight', 'Weight']
  ])(
    'places the %s Widget in its grid area',
    (area, title) => {
      const widget = mountDashboard()
        .get(`.dashboard-view > .${area}`)

      expect(widget.classes()).toContain('widget-frame')
      expect(widget.get('.title').text()).toBe(title)
    }
  )

  it('shows exactly five Widgets', () => {
    expect(
      mountDashboard().findAll('.widget-frame')
    ).toHaveLength(5)
  })

  it('shows the theme toggle in development', async () => {
    const view = mountDashboard()

    await vi.waitFor(() =>
      expect(view.find('.dev-toggle').exists())
        .toBe(true)
    )
  })
})
