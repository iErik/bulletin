import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import DashboardView from './DashboardView.vue'

const mountDashboard = () =>
  mount(DashboardView, {
    global: { plugins: [createPinia()] }
  })

describe('DashboardView', () => {
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
