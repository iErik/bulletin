import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { useFixedToday } from '@/testing/clock'
import TasksView from './TasksView.vue'

let view: VueWrapper | undefined

const mountView = (): VueWrapper => {
  const bar = document.createElement('div')
  bar.id = 'title-bar-content'
  document.body.append(bar)
  view = mount(TasksView, {
    attachTo: document.body,
    global: { plugins: [createPinia()] }
  })
  return view
}

describe('TasksView', () => {
  useFixedToday()

  afterEach(() => {
    view?.unmount()
    view = undefined
    document.body.innerHTML = ''
  })

  it('lays out the Page grid with five empty cells',
    () => {
      const page = mountView()

      expect(page.find('.page-grid').exists()).toBe(true)
      for (const cell of [
        'wide',
        'side',
        'left',
        'middle',
        'right'
      ]) {
        expect(page.get(`.${cell}`).element.children)
          .toHaveLength(0)
      }
    })

  it('puts the date header in the Title Bar', () => {
    mountView()

    expect(
      document.querySelector(
        '#title-bar-content > .date-header'
      )
    ).not.toBeNull()
  })
})
