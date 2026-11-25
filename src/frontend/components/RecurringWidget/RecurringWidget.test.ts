import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BulletinApi } from '@shared/bridge'
import type { Transaction } from '@shared/expenses'
import { formatAmount } from '@/expenses/money'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import RecurringWidget from './RecurringWidget.vue'

let widget: VueWrapper | undefined

const tx = (
  id: number,
  date: string,
  amount: number,
  description: string
): Transaction => ({
  id,
  date,
  description,
  categoryId: 1,
  amount
})

// Today is Nov 9th, 2026 (useFixedToday).
const SAMPLE: Transaction[] = [
  tx(1, '2026-09-08', -2_190, 'Spotify'),
  tx(2, '2026-10-08', -2_190, 'spotify '),
  tx(3, '2026-11-08', -2_190, 'Spotify'),
  tx(4, '2026-09-15', -11_990, 'Internet'),
  tx(5, '2026-10-15', -11_990, 'Internet'),
  tx(6, '2026-11-01', -11_990, 'Internet'),
  // Sep and Nov only: not recurring.
  tx(7, '2026-09-03', -5_000, 'Gym'),
  tx(8, '2026-11-03', -5_000, 'Gym'),
  tx(9, '2026-11-02', 1_000_000, 'Salary')
]

const mountWidget = async (
  transactions: Transaction[] = SAMPLE
): Promise<{
  wrapper: VueWrapper
  api: BulletinApi
}> => {
  const api = stubBulletin()
  vi.mocked(api.expenses.list).mockResolvedValue({
    ok: true,
    value: transactions
  })
  setActivePinia(createPinia())
  widget = mount(RecurringWidget, { attachTo: document.body })
  await flushPromises()
  return { wrapper: widget, api }
}

const texts = (wrapper: VueWrapper, selector: string): string[] =>
  wrapper.findAll(selector).map(el => el.text())

describe('RecurringWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('has the Recurring header, icon and "Detected"',
    async () => {
      const { wrapper } = await mountWidget()

      expect(wrapper.get('.title').text()).toBe('Recurring')
      expect(wrapper.find('.tile .app-icon').exists())
        .toBe(true)
      expect(wrapper.get('.actions').text()).toBe('Detected')
    })

  it('loads from three months back to the Selected Date',
    async () => {
      const { api } = await mountWidget()

      expect(api.expenses.list).toHaveBeenCalledWith({
        from: '2026-08-01',
        to: '2026-11-09'
      })
    })

  it('lists the Recurring Expenses by amount', async () => {
    const { wrapper } = await mountWidget()

    expect(texts(wrapper, '.row > .name'))
      .toEqual(['Internet', 'Spotify'])
    expect(texts(wrapper, '.row > .meta')).toEqual([
      'Monthly · 1st · next Dec 1',
      'Monthly · 8th · next Dec 8'
    ])
    expect(texts(wrapper, '.row > .amount')).toEqual([
      formatAmount(11_990),
      formatAmount(2_190)
    ])
  })

  it('shows the monthly total and share of income',
    async () => {
      const { wrapper } = await mountWidget()

      expect(wrapper.get('.footer').text()).toBe(
        `${formatAmount(14_180)} / month fixed`
        + ' · 1% of income'
      )
    })

  it('drops the share of income without Income',
    async () => {
      const { wrapper } = await mountWidget(
        SAMPLE.filter(({ amount }) => amount < 0)
      )

      expect(wrapper.get('.footer').text())
        .toBe(`${formatAmount(14_180)} / month fixed`)
    })

  it('scrolls the list with the overlay scrollbar',
    async () => {
      const { wrapper } = await mountWidget()

      expect(wrapper.find('.view > .scroller').exists())
        .toBe(true)
      expect(wrapper.find('.view > .overlay-scrollbar')
        .exists()).toBe(true)
    })

  it('shows the empty state without Recurring Expenses',
    async () => {
      const { wrapper } = await mountWidget([
        tx(1, '2026-11-03', -5_000, 'Gym')
      ])

      expect(wrapper.get('.message').text())
        .toBe('No recurring expenses detected')
      expect(wrapper.find('.row').exists()).toBe(false)
      expect(wrapper.find('.footer').exists()).toBe(false)
    })

  it('shows nothing until the first load', () => {
    const api = stubBulletin()
    vi.mocked(api.expenses.list)
      .mockReturnValue(new Promise(() => {}))
    setActivePinia(createPinia())
    widget = mount(RecurringWidget, { attachTo: document.body })

    expect(widget.find('.message').exists()).toBe(false)
    expect(widget.find('.footer').exists()).toBe(false)
  })

  it('says so when the load fails', async () => {
    const api = stubBulletin()
    vi.mocked(api.expenses.list).mockResolvedValue({
      ok: false,
      error: { code: 'internal' }
    })
    setActivePinia(createPinia())
    widget = mount(RecurringWidget, { attachTo: document.body })
    await flushPromises()

    expect(widget.get('[role="alert"]').text())
      .toBe('Couldn’t load recurring expenses.')
    expect(widget.find('.footer').exists()).toBe(false)
  })

  it('reloads when the Selected Date changes', async () => {
    const { wrapper, api } = await mountWidget()
    vi.mocked(api.expenses.list).mockResolvedValue({
      ok: true,
      value: SAMPLE.filter(({ date }) => date <= '2026-10-31')
    })

    useSelectedDateStore().setDay(new Date(2026, 9, 31))
    await flushPromises()

    expect(api.expenses.list).toHaveBeenLastCalledWith({
      from: '2026-07-01',
      to: '2026-10-31'
    })
    // Sep and Oct only, as of Oct 31: none recur.
    expect(wrapper.get('.message').text())
      .toBe('No recurring expenses detected')
  })

  it('drops a load a newer one overtook', async () => {
    const api = stubBulletin()
    let finishFirst = (): void => {}
    vi.mocked(api.expenses.list)
      .mockImplementationOnce(() => new Promise(done => {
        finishFirst = () => done({ ok: true, value: SAMPLE })
      }))
      .mockResolvedValue({ ok: true, value: [] })
    setActivePinia(createPinia())
    widget = mount(RecurringWidget, { attachTo: document.body })

    useSelectedDateStore().setDay(new Date(2026, 10, 5))
    await flushPromises()
    finishFirst()
    await flushPromises()

    expect(widget.get('.message').text())
      .toBe('No recurring expenses detected')
  })

  it('reloads on Transaction writes only', async () => {
    const { api } = await mountWidget()
    const calls = (): number =>
      vi.mocked(api.expenses.list).mock.calls.length
    const before = calls()

    await api.expenses.createCategory('Food')
    await api.mood.create({ date: '2026-11-09', mood: 'happy' })
    await flushPromises()
    expect(calls()).toBe(before)

    await api.expenses.create({
      date: '2026-11-09',
      description: 'Coffee',
      categoryId: 1,
      amount: -1_000
    })
    await flushPromises()
    expect(calls()).toBe(before + 1)
  })
})
