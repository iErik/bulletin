import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import SleepView from './SleepView.vue'

// happy-dom has no layout: days are ROW tall, stacked
// in order, in a list VIEW tall. Same stand-in as
// SleepTimeline's tests.
const ROW = 50
const VIEW = 400

const fakeLayout = (): void => {
  const index = (el: Element): number =>
    [...el.parentElement!.children].indexOf(el)
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return this.dataset.day ? index(this) * ROW : 0
    })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
    .mockReturnValue(ROW)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get')
    .mockReturnValue(VIEW)
  vi.spyOn(Element.prototype, 'scrollHeight', 'get')
    .mockImplementation(function (this: Element) {
      return this.querySelectorAll('.day-row').length * ROW
    })
}

/** The scrollTop that centres the row at `index`. */
const centred = (index: number): number =>
  index * ROW - (VIEW - ROW) / 2

const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await nextTick()
}

let view: VueWrapper | undefined

const mountView = async (): Promise<{
  view: VueWrapper
  store: ReturnType<typeof useSelectedDateStore>
}> => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const bar = document.createElement('div')
  bar.id = 'title-bar-content'
  document.body.append(bar)
  view = mount(SleepView, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await settle()
  return { view, store: useSelectedDateStore() }
}

describe('SleepView', () => {
  useFixedToday()
  beforeEach(fakeLayout)

  afterEach(() => {
    view?.unmount()
    view = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('shows the Timeline in the wide cell, with no fade',
    async () => {
      const page = (await mountView()).view
      const timeline = page.get(
        '.wide > .sleep > .body > .sleep-timeline'
      )

      expect(timeline.classes()).not.toContain('-fade')
      expect(page.get('.left .title').text())
        .toBe('Schedule')
      expect(page.get('.side .title').text())
        .toBe('Overview')
      expect(page.get('.right .title').text())
        .toBe('Sleep & Mood')
      for (const cell of ['middle']) {
        expect(page.get(`.${cell}`).element.children)
          .toHaveLength(0)
      }
    })

  it('centres the Selected Date, and follows a change',
    async () => {
      const { view: page, store } = await mountView()
      const list = page.get<HTMLElement>('.rows').element
      const indexOf = (key: string): number =>
        [...list.querySelectorAll('.day-row')].findIndex(
          row => row.getAttribute('data-day') === key
        )

      expect(list.scrollTop)
        .toBe(centred(indexOf('2026-11-09')))

      store.step(-1)
      await settle()
      expect(list.scrollTop)
        .toBe(centred(indexOf('2026-11-08')))
    })
})
