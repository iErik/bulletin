import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BulletinApi } from '@shared/bridge'
import type { Budget, Transaction } from '@shared/expenses'
import { formatAmount } from '@/expenses/money'
import { monthPace } from '@/expenses/month-pace'
import { formatDate } from '@/locale/format'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import MonthPaceWidget from './MonthPaceWidget.vue'

let widget: VueWrapper | undefined

const tx = (
  id: number,
  date: string,
  amount: number,
  description = 'Groceries'
): Transaction => ({
  id,
  date,
  description,
  categoryId: 1,
  amount
})

const BUDGET: Budget = {
  month: '2026-11',
  amount: 2_400_000
}

const SAMPLE_TXS: Transaction[] = [
  tx(1, '2026-11-02', -379_500, 'Groceries'),
  tx(2, '2026-11-06', -1_299_300, 'MPB M5')
]

const mountWidget = async (options: {
  transactions?: Transaction[]
  budget?: Budget | null
} = {}): Promise<{
  wrapper: VueWrapper
  api: BulletinApi
  store: ReturnType<typeof useSelectedDateStore>
}> => {
  const {
    transactions = SAMPLE_TXS,
    budget = BUDGET
  } = options
  const api = stubBulletin()
  vi.mocked(api.expenses.list).mockResolvedValue({
    ok: true,
    value: transactions
  })
  vi.mocked(api.expenses.getBudget).mockResolvedValue({
    ok: true,
    value: budget
  })
  const pinia = createPinia()
  setActivePinia(pinia)
  widget = mount(MonthPaceWidget, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return {
    wrapper: widget,
    api,
    store: useSelectedDateStore()
  }
}

describe('MonthPaceWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('loads the month and composes header, chart and bars',
    async () => {
      const { wrapper, api } = await mountWidget()
      const pace = monthPace(
        SAMPLE_TXS, BUDGET, new Date(2026, 10, 9)
      )
      const proj = formatAmount(Math.round(pace.projection))
      const limit = formatAmount(BUDGET.amount)

      expect(api.expenses.list).toHaveBeenCalledWith({
        from: '2026-11-01',
        to: '2026-11-30'
      })
      expect(api.expenses.getBudget)
        .toHaveBeenCalledWith('2026-11')
      expect(wrapper.get('.title').text()).toBe('Month Pace')
      expect(wrapper.get('.projected').text())
        .toBe(`Projected ${proj} / ${limit}`)
      expect(wrapper.find('.month-pace-chart').exists())
        .toBe(true)
      expect(wrapper.find('.month-pace-bars').exists())
        .toBe(true)
      expect(wrapper.get('.tooltip').text())
        .toBe(`Today · ${formatAmount(pace.spent)}`)
    })

  it('shows projection alone without a Budget', async () => {
    const { wrapper } = await mountWidget({ budget: null })
    const pace = monthPace(
      SAMPLE_TXS, null, new Date(2026, 10, 9)
    )
    const proj = formatAmount(Math.round(pace.projection))

    expect(wrapper.get('.projected').text())
      .toBe(`Projected ${proj}`)
    expect(wrapper.find('.budget-line').exists()).toBe(false)
  })

  it('shows zero projection and flat line with no expenses',
    async () => {
      const { wrapper } = await mountWidget({
        transactions: [],
        budget: BUDGET
      })

      expect(wrapper.get('.projected').text()).toBe(
        `Projected ${formatAmount(0)} / `
        + formatAmount(BUDGET.amount)
      )
      expect(wrapper.find('.budget-line').exists()).toBe(true)
      expect(wrapper.findAll('.month-pace-bars .bar'))
        .toHaveLength(0)
    })

  it('recomputes without reloading when only the day changes',
    async () => {
      const { wrapper, api, store } = await mountWidget()
      const listCalls = vi.mocked(api.expenses.list)
        .mock.calls.length

      store.setDay(new Date(2026, 10, 5))
      await flushPromises()

      expect(api.expenses.list).toHaveBeenCalledTimes(listCalls)
      const pace = monthPace(
        SAMPLE_TXS, BUDGET, new Date(2026, 10, 5)
      )
      const short = formatDate(new Date(2026, 10, 5), 'short')
      expect(wrapper.get('.tooltip').text())
        .toBe(`${short} · ${formatAmount(pace.spent)}`)
      expect(wrapper.get('.projected').text()).toBe(
        `Projected ${formatAmount(Math.round(pace.projection))}`
        + ` / ${formatAmount(BUDGET.amount)}`
      )
    })

  it('shows spent as projection and hides line on last day',
    async () => {
      const octTxs = [tx(3, '2026-10-10', -500_000, 'Rent')]
      const { wrapper, api, store } = await mountWidget()
      vi.mocked(api.expenses.list).mockResolvedValue({
        ok: true,
        value: octTxs
      })
      vi.mocked(api.expenses.getBudget).mockResolvedValue({
        ok: true,
        value: { month: '2026-10', amount: 2_000_000 }
      })

      store.setDay(new Date(2026, 9, 31))
      await flushPromises()

      expect(api.expenses.list).toHaveBeenLastCalledWith({
        from: '2026-10-01',
        to: '2026-10-31'
      })
      expect(api.expenses.getBudget)
        .toHaveBeenLastCalledWith('2026-10')
      expect(wrapper.find('.projection-line').exists())
        .toBe(false)
      expect(wrapper.get('.projected').text()).toBe(
        `Projected ${formatAmount(500_000)} / `
        + formatAmount(2_000_000)
      )
    })

  it('drops stale responses when loads overlap', async () => {
    const api = stubBulletin()
    let finishFirst = (): void => {}
    vi.mocked(api.expenses.list)
      .mockImplementationOnce(() => new Promise(done => {
        finishFirst = () => done({
          ok: true,
          value: SAMPLE_TXS
        })
      }))
      .mockResolvedValue({ ok: true, value: [] })
    vi.mocked(api.expenses.getBudget).mockResolvedValue({
      ok: true,
      value: null
    })

    const pinia = createPinia()
    setActivePinia(pinia)
    widget = mount(MonthPaceWidget, {
      attachTo: document.body,
      global: { plugins: [pinia] }
    })

    useSelectedDateStore().setDay(new Date(2026, 9, 20))
    await flushPromises()
    finishFirst()
    await flushPromises()

    expect(widget.get('.projected').text())
      .toBe(`Projected ${formatAmount(0)}`)
  })

  it('reloads on transaction/budget writes, ignores others',
    async () => {
      const { wrapper, api } = await mountWidget({
        transactions: [],
        budget: null
      })
      const calls = (): number =>
        vi.mocked(api.expenses.list).mock.calls.length

      // Unrelated data sources do not trigger reload.
      const before = calls()
      await api.expenses.createCategory('Food')
      await api.mood.create({
        date: '2026-11-09',
        mood: 'happy'
      })
      await api.weight.create({
        date: '2026-11-09',
        grams: 75_000
      })
      await flushPromises()
      expect(calls()).toBe(before)

      // Transaction write reloads.
      vi.mocked(api.expenses.list).mockResolvedValue({
        ok: true,
        value: [tx(9, '2026-11-09', -90_000, 'Dinner')]
      })
      await api.expenses.create({
        date: '2026-11-09',
        description: 'Dinner',
        categoryId: 1,
        amount: -90_000
      })
      await flushPromises()
      expect(calls()).toBe(before + 1)
      expect(wrapper.get('.projected').text())
        .toBe(`Projected ${formatAmount(300_000)}`)

      // Budget write reloads.
      vi.mocked(api.expenses.getBudget).mockResolvedValue({
        ok: true,
        value: BUDGET
      })
      await api.expenses.setBudget(BUDGET)
      await flushPromises()
      expect(calls()).toBe(before + 2)
      expect(wrapper.get('.projected').text()).toBe(
        `Projected ${formatAmount(300_000)} / `
        + formatAmount(BUDGET.amount)
      )
    })

  it.each(['list', 'getBudget'] as const)(
    'shows an inline error when %s fails',
    async method => {
      const api = stubBulletin()
      vi.mocked(api.expenses[method]).mockResolvedValue({
        ok: false,
        error: { code: 'internal' }
      })
      const pinia = createPinia()
      setActivePinia(pinia)
      widget = mount(MonthPaceWidget, {
        attachTo: document.body,
        global: { plugins: [pinia] }
      })
      await flushPromises()

      expect(widget.get('[role="alert"]').text())
        .toBe('Couldn’t load this month.')
      expect(widget.find('.projected').exists()).toBe(false)
      expect(widget.find('.month-pace-chart').exists())
        .toBe(false)
      expect(widget.find('.month-pace-bars').exists())
        .toBe(false)
    }
  )
})
