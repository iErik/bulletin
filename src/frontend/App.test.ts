import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import {
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import OverlayScrollbar
  from '@/components/OverlayScrollbar/OverlayScrollbar.vue'
import { stubBulletin } from '@/testing/bulletin'
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
    expect(
      app.find('.body > .page > .scroller > .page-grid')
        .exists()
    ).toBe(true)
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
    ['/tasks', 'Tasks'],
    ['/notes', 'Notes']
  ])('shows a placeholder on %s', async (path, label) => {
    const app = await mountAt(path)

    const view = app.get(
      '.page > .scroller > .placeholder-view'
    )
    expect(view.get('h1').text()).toBe(label)
    expect(view.text()).toContain('Coming soon')
  })

  it('shows the Sleep Page, highlighted in the Sidebar',
    async () => {
      const app = await mountAt('/sleep')

      expect(app.find('.placeholder-view').exists())
        .toBe(false)
      expect(
        app.find(
          '.page > .scroller > .page-grid .sleep-timeline'
        ).exists()
      ).toBe(true)
      expect(
        app.get('a[aria-current="page"]')
          .attributes('aria-label')
      ).toBe('Sleep')
    })

  it('shows the Mood Page, highlighted in the Sidebar',
    async () => {
      const app = await mountAt('/mood')

      expect(app.find('.placeholder-view').exists())
        .toBe(false)
      expect(
        app.find(
          '.page > .scroller > .page-grid > .left'
          + ' > .mood-widget'
        ).exists()
      ).toBe(true)
      expect(
        app.get('a[aria-current="page"]')
          .attributes('aria-label')
      ).toBe('Mood')
    })

  it('shows the Expenses Page, highlighted in the Sidebar',
    async () => {
      const app = await mountAt('/expenses')

      expect(app.find('.placeholder-view').exists())
        .toBe(false)
      expect(
        app.find(
          '.page > .scroller > .page-grid > .side'
          + ' > .expenses-widget'
        ).exists()
      ).toBe(true)
      expect(
        app.get('a[aria-current="page"]')
          .attributes('aria-label')
      ).toBe('Expenses')
    })

  it('draws an overlay scrollbar on the Page',
    async () => {
      const app = await mountAt('/notes')
      const bar = app.getComponent(OverlayScrollbar)

      expect(bar.props('target')).toBe(
        app.get('.page > .scroller').element
      )
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

  it('shows Mood on the day chosen on the Dashboard',
    async () => {
      const api = stubBulletin()
      vi.mocked(api.mood.list).mockResolvedValue({
        ok: true,
        value: [{ date: '2026-10-31', mood: 'happy' }]
      })
      await router.push('/')
      await router.isReady()
      const app = mount(App, {
        attachTo: document.body,
        global: { plugins: [createPinia(), router] }
      })
      try {
        await settle()
        for (let i = 0; i < 9; i++) {
          await app.get('[aria-label="Previous day"]')
            .trigger('click')
        }
        vi.mocked(api.mood.list).mockClear()

        await router.push('/mood')
        await settle()

        expect(api.mood.list).toHaveBeenCalledWith({
          from: '2026-10-01',
          to: '2026-10-31'
        })
        expect(
          app.get('.left > .mood-widget .pill.-selected')
            .attributes('aria-label')
        ).toBe('Oct 31 · Happy')
      } finally {
        app.unmount()
      }
    })

  it('loads Expenses for the month chosen on the Dashboard',
    async () => {
      const api = stubBulletin()
      await router.push('/')
      await router.isReady()
      const app = mount(App, {
        attachTo: document.body,
        global: { plugins: [createPinia(), router] }
      })
      try {
        await settle()
        await app.get('.date-header > .date')
          .trigger('click')
        await app.get('select[aria-label="Month"]')
          .setValue('9')
        await settle()

        vi.mocked(api.expenses.list).mockClear()
        vi.mocked(api.expenses.getBudget).mockClear()
        await router.push('/expenses')
        await flushPromises()

        expect(api.expenses.list).toHaveBeenCalledWith(
          { from: '2026-10-01', to: '2026-10-31' }
        )
        expect(api.expenses.getBudget)
          .toHaveBeenCalledWith('2026-10')
      } finally {
        app.unmount()
      }
    })
})
