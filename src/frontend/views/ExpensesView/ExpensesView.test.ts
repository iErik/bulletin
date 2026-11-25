import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Transaction } from '@shared/expenses'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import ExpensesView from './ExpensesView.vue'

let view: VueWrapper | undefined

const RENT: Transaction = {
  id: 1,
  date: '2026-10-05',
  description: 'Rent',
  categoryId: 1,
  amount: -120_000
}

const mountView = async (): Promise<{
  view: VueWrapper
  store: ReturnType<typeof useSelectedDateStore>
}> => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const bar = document.createElement('div')
  bar.id = 'title-bar-content'
  document.body.append(bar)
  view = mount(ExpensesView, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { view, store: useSelectedDateStore() }
}

describe('ExpensesView', () => {
  useFixedToday()

  afterEach(() => {
    view?.unmount()
    view = undefined
    document.body.innerHTML = ''
  })

  it('places Month Pace, Expenses and Recurring',
    async () => {
      stubBulletin()
      const page = (await mountView()).view

      expect(
        page.find('.page-grid > .wide > .month-pace-widget')
          .exists()
      ).toBe(true)
      expect(
        page.find('.page-grid > .side > .expenses-widget')
          .exists()
      ).toBe(true)
      expect(
        page.find('.page-grid > .middle > .recurring-widget')
          .exists()
      ).toBe(true)
      for (const cell of ['left', 'right']) {
        expect(page.get(`.${cell}`).element.children)
          .toHaveLength(0)
      }
    })

  it('puts the date header in the Title Bar', async () => {
    stubBulletin()
    await mountView()

    expect(
      document.querySelector(
        '#title-bar-content > .date-header'
      )
    ).not.toBeNull()
  })

  it('reloads when the Selected Date changes month',
    async () => {
      const api = stubBulletin()
      const { view: page, store } = await mountView()

      expect(api.expenses.list).toHaveBeenCalledWith(
        { from: '2026-11-01', to: '2026-11-30' }
      )
      expect(api.expenses.getBudget)
        .toHaveBeenCalledWith('2026-11')

      vi.mocked(api.expenses.list).mockResolvedValue(
        { ok: true, value: [RENT] }
      )
      store.setDay(new Date(2026, 9, 20))
      await flushPromises()

      expect(api.expenses.list).toHaveBeenCalledWith(
        { from: '2026-10-01', to: '2026-10-31' }
      )
      expect(api.expenses.getBudget)
        .toHaveBeenLastCalledWith('2026-10')
      expect(page.get('.card.-expenses > .value').text())
        .toBe('R$1,200.00')
      expect(page.get('.month-pace-widget .projected').text())
        .toBe('Projected R$1,860.00')
    })
})
