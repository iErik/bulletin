import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import { useFixedToday } from '@/testing/clock'
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
    expect(app.find('.body > .page > .page-grid').exists())
      .toBe(true)
    expect(app.findAll('.page .widget-frame'))
      .toHaveLength(5)
  })

  it('puts the Sidebar in its region', async () => {
    const app = await mountAt('/')

    expect(
      app.find('.body > .sidebar > .app-sidebar').exists()
    ).toBe(true)
  })

  it.each([
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

  it('shows the Sleep Page, highlighted in the Sidebar',
    async () => {
      const app = await mountAt('/sleep')

      expect(app.find('.placeholder-view').exists())
        .toBe(false)
      expect(
        app.find('.page > .page-grid .sleep-timeline')
          .exists()
      ).toBe(true)
      expect(
        app.get('a[aria-current="page"]')
          .attributes('aria-label')
      ).toBe('Sleep')
    })
})

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

const centred = (index: number): number =>
  index * ROW - (VIEW - ROW) / 2

const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await nextTick()
}

describe('the Selected Date across Pages', () => {
  useFixedToday()

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('centres Sleep on the day chosen on the Dashboard',
    async () => {
      fakeLayout()
      await router.push('/')
      await router.isReady()
      const app = mount(App, {
        attachTo: document.body,
        global: { plugins: [createPinia(), router] }
      })
      try {
        await settle()
        await app.get('[aria-label="Previous day"]')
          .trigger('click')
        await router.push('/sleep')
        await settle()

        const list = app.get<HTMLElement>(
          '.sleep-timeline .rows'
        ).element
        const rows = [...list.querySelectorAll('.day-row')]
        const index = rows.findIndex(row =>
          row.classList.contains('-selected'))

        expect(rows[index]?.getAttribute('data-day'))
          .toBe('2026-11-08')
        expect(list.scrollTop).toBe(centred(index))
      } finally {
        app.unmount()
      }
    })
})
