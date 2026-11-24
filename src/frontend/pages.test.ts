import { describe, expect, it } from 'vitest'
import ExpensesView
  from './views/ExpensesView/ExpensesView.vue'
import MoodView from './views/MoodView/MoodView.vue'
import SleepView from './views/SleepView/SleepView.vue'
import { isPageActive, PAGES, type Page } from './pages'

const page = (name: string): Page => {
  const found = PAGES.find(p => p.name === name)
  if (!found) throw new Error(`No Page ${name}`)
  return found
}

describe('PAGES', () => {
  it('lists the six Pages in Sidebar order', () => {
    expect(PAGES.map(p => [p.label, p.path])).toEqual([
      ['Dashboard', '/'],
      ['Sleep', '/sleep'],
      ['Mood', '/mood'],
      ['Tasks', '/tasks'],
      ['Expenses', '/expenses'],
      ['Notes', '/notes']
    ])
  })

  it('gives the Sleep Page its view', () => {
    expect(page('sleep').view).toBe(SleepView)
  })

  it('gives the Mood Page its view', () => {
    expect(page('mood').view).toBe(MoodView)
  })

  it('gives the Expenses Page its view', () => {
    expect(page('expenses').view).toBe(ExpensesView)
  })
})

describe('isPageActive', () => {
  it('makes the Dashboard active only on /', () => {
    const dashboard = page('dashboard')

    expect(isPageActive(dashboard, '/')).toBe(true)
    expect(isPageActive(dashboard, '/sleep')).toBe(false)
    expect(isPageActive(dashboard, '/x')).toBe(false)
  })

  it.each(['sleep', 'mood', 'tasks', 'expenses', 'notes'])(
    'makes %s active on its path and below it',
    name => {
      const { path } = page(name)

      expect(isPageActive(page(name), path)).toBe(true)
      expect(isPageActive(page(name), `${path}/x/y`))
        .toBe(true)
      expect(isPageActive(page(name), '/')).toBe(false)
    }
  )

  it('needs a whole path segment to match', () => {
    expect(isPageActive(page('sleep'), '/sleepy'))
      .toBe(false)
  })
})
