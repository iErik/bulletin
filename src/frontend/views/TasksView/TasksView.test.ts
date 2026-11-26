import { afterEach, describe, expect, it } from 'vitest'
import {
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia } from 'pinia'
import { useFixedToday } from '@/testing/clock'
import TasksView from './TasksView.vue'

let view: VueWrapper | undefined

const mountView = async (): Promise<VueWrapper> => {
  const bar = document.createElement('div')
  bar.id = 'title-bar-content'
  document.body.append(bar)
  view = mount(TasksView, {
    attachTo: document.body,
    global: { plugins: [createPinia()] }
  })
  await flushPromises()
  return view
}

describe('TasksView', () => {
  useFixedToday()

  afterEach(() => {
    view?.unmount()
    view = undefined
    document.body.innerHTML = ''
  })

  it('places Task Insights in #right and keeps other cells empty',
    async () => {
      const page = await mountView()

      expect(page.find('.page-grid').exists()).toBe(true)
      expect(
        page.get('.right').find('.task-insights-widget').exists()
      ).toBe(true)
      for (const cell of ['wide', 'side', 'left', 'middle']) {
        expect(page.get(`.${cell}`).element.children)
          .toHaveLength(0)
      }
    })

  it('puts the date header in the Title Bar', async () => {
    await mountView()

    expect(
      document.querySelector(
        '#title-bar-content > .date-header'
      )
    ).not.toBeNull()
  })
})
