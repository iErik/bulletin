import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import Icon from '@/components/Icon/Icon.vue'
import DashboardView from './DashboardView.vue'

let dashboard: VueWrapper | undefined

// Stands in for the Title Bar the header goes into.
const mountDashboard = (): VueWrapper => {
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
    ['sleep', 'Sleep', 'moon'],
    ['expenses', 'Expenses', 'dollar-sign'],
    ['mood', 'Mood', 'mood'],
    ['habits', 'Habits', 'checklist'],
    ['weight', 'Weight', 'activity']
  ])(
    'places the %s Widget in its grid area',
    (area, title, icon) => {
      const cell = mountDashboard()
        .get(`.dashboard-view > .${area}`)
      // The Mood Widget wraps its frame.
      const widget = cell.classes('widget-frame')
        ? cell
        : cell.get('.widget-frame')

      expect(widget.get('.title').text()).toBe(title)
      expect(widget.get('.tile').findComponent(Icon)
        .props('name')).toBe(icon)
    }
  )

  it('fills the Sleep Widget with its Timeline', () => {
    expect(
      mountDashboard().find('.sleep > .body > .sleep-timeline')
        .exists()
    ).toBe(true)
  })

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
