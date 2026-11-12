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
import ExpensesWidget from './ExpensesWidget.vue'

let widget: VueWrapper | undefined

const SALARY: Transaction = {
  id: 1,
  date: '2026-11-03',
  description: 'Salary',
  categoryId: 1,
  amount: 2_500_000
}

/** Mounts it; stub the bulletin first. */
const mountWidget = async (): Promise<VueWrapper> => {
  setActivePinia(createPinia())
  widget = mount(ExpensesWidget)
  await flushPromises()
  return widget
}

const income = (wrapper: VueWrapper): string =>
  wrapper.get('.card.-income > .value').text()

describe('ExpensesWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
  })

  it('loads the Selected Date’s month', async () => {
    const api = stubBulletin()
    vi.mocked(api.expenses.list).mockResolvedValue(
      { ok: true, value: [SALARY] }
    )
    vi.mocked(api.expenses.getBudget).mockResolvedValue(
      { ok: true, value: { month: '2026-11', amount: 1 } }
    )

    const wrapper = await mountWidget()

    expect(api.expenses.list).toHaveBeenCalledWith(
      { from: '2026-11-01', to: '2026-11-30' }
    )
    expect(api.expenses.getBudget)
      .toHaveBeenCalledWith('2026-11')
    expect(income(wrapper)).toBe('R$25,000.00')
  })

  it('shows the Transactions with their Category', async () => {
    const api = stubBulletin()
    vi.mocked(api.expenses.list).mockResolvedValue(
      { ok: true, value: [SALARY] }
    )
    vi.mocked(api.expenses.listCategories)
      .mockResolvedValue(
        { ok: true, value: [{ id: 1, name: 'Payment' }] }
      )

    const wrapper = await mountWidget()

    expect(wrapper.get('tbody .chip').text())
      .toBe('Payment')
  })

  it('reloads when the month changes', async () => {
    const api = stubBulletin()
    await mountWidget()

    useSelectedDateStore().setDay(new Date(2026, 9, 20))
    await flushPromises()

    expect(api.expenses.list).toHaveBeenLastCalledWith(
      { from: '2026-10-01', to: '2026-10-31' }
    )
    expect(api.expenses.getBudget)
      .toHaveBeenLastCalledWith('2026-10')
  })

  it('keeps the newer month when loads overlap', async () => {
    const api = stubBulletin()
    let finish = (): void => {}
    vi.mocked(api.expenses.list)
      .mockImplementationOnce(() => new Promise(done => {
        finish = () => done({ ok: true, value: [SALARY] })
      }))
    setActivePinia(createPinia())
    widget = mount(ExpensesWidget)

    useSelectedDateStore().setDay(new Date(2026, 9, 20))
    await flushPromises()
    finish()
    await flushPromises()

    expect(income(widget)).toBe('R$0.00')
  })

  it('shows a Budget once saved', async () => {
    const api = stubBulletin()
    const wrapper = await mountWidget()

    await wrapper.get('.budget-value > .value')
      .trigger('click')
    await wrapper.get('.budget-value > input')
      .setValue('1500')
    await wrapper.get('.budget-value > input')
      .trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(api.expenses.setBudget).toHaveBeenCalledWith(
      { month: '2026-11', amount: 150_000 }
    )
    expect(wrapper.get('.budget-value > .value').text())
      .toBe('R$1,500.00')
  })

  it('drops a deleted Transaction', async () => {
    const api = stubBulletin()
    vi.mocked(api.expenses.list).mockResolvedValue(
      { ok: true, value: [SALARY] }
    )
    const wrapper = await mountWidget()

    await wrapper.get('.delete').trigger('click')
    await wrapper.get('.-confirm').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('tbody > tr')).toHaveLength(0)
    expect(income(wrapper)).toBe('R$0.00')
  })

  it('keeps an edit in the month', async () => {
    const api = stubBulletin()
    vi.mocked(api.expenses.list).mockResolvedValue(
      { ok: true, value: [SALARY] }
    )
    const wrapper = await mountWidget()

    await wrapper.get('td.value .value').trigger('click')
    await wrapper.get('td.value input').setValue('300')
    await wrapper.get('td.value input')
      .trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(income(wrapper)).toBe('R$300.00')
  })

  it.each(['list', 'getBudget', 'listCategories'] as const)(
    'shows an inline error when %s fails',
    async method => {
      const api = stubBulletin()
      vi.mocked(api.expenses[method]).mockResolvedValue(
        { ok: false, error: { code: 'internal' } }
      )

      const wrapper = await mountWidget()

      expect(wrapper.get('[role="alert"]').text())
        .toBe('Couldn’t load this month.')
      expect(wrapper.find('.expense-cards').exists())
        .toBe(false)
    }
  )
})
