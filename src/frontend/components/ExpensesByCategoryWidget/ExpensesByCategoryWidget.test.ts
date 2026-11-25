import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BulletinApi } from '@shared/bridge'
import type {
  Category,
  Transaction
} from '@shared/expenses'
import type { StorageResult } from '@shared/storage'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import ExpensesByCategoryWidget
  from './ExpensesByCategoryWidget.vue'

let widget: VueWrapper | undefined

const CATEGORIES: Category[] = [
  { id: 1, name: 'Equipment' },
  { id: 2, name: 'Food' },
  { id: 3, name: 'Cats' },
  { id: 4, name: 'Taxes' },
  { id: 5, name: 'Rent' }
]

let nextId = 1

const tx = (
  categoryId: number,
  date: string,
  amount: number
): Transaction => ({
  id: nextId++,
  date,
  description: 'Spend',
  categoryId,
  amount
})

// Today is Nov 9th: the period is Nov 1–9, compared
// against Oct 1–9.
const SAMPLE: Transaction[] = [
  tx(1, '2026-11-03', -1_600_000),
  tx(2, '2026-11-04', -84_000),
  tx(2, '2026-10-04', -63_600),
  tx(3, '2026-11-05', -40_000),
  tx(3, '2026-10-05', -40_000),
  tx(4, '2026-10-06', -228_200),
  tx(5, '2026-11-02', 500_000)
]

const mountWidget = async (
  transactions: Transaction[] = SAMPLE,
  listed: StorageResult<Transaction[]> =
    { ok: true, value: transactions }
): Promise<{
  wrapper: VueWrapper
  api: BulletinApi
  store: ReturnType<typeof useSelectedDateStore>
}> => {
  const api = stubBulletin()
  vi.mocked(api.expenses.list).mockResolvedValue(listed)
  vi.mocked(api.expenses.listCategories).mockResolvedValue(
    { ok: true, value: CATEGORIES }
  )
  const pinia = createPinia()
  setActivePinia(pinia)
  widget = mount(ExpensesByCategoryWidget, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper: widget, api, store: useSelectedDateStore() }
}

const rowTexts = (wrapper: VueWrapper): string[][] =>
  wrapper.findAll('.row').map(row => [
    row.get('.name').text(),
    row.get('.spend').text(),
    row.get('.change').text()
  ])

describe('ExpensesByCategoryWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('loads both periods and the Categories', async () => {
    const { api } = await mountWidget()

    expect(api.expenses.list).toHaveBeenCalledWith(
      { from: '2026-10-01', to: '2026-11-09' }
    )
    expect(api.expenses.listCategories).toHaveBeenCalled()
  })

  it('titles the Widget and compares with last month',
    async () => {
      const { wrapper } = await mountWidget()

      expect(wrapper.get('.title').text())
        .toBe('By Category')
      expect(wrapper.get('.actions > .versus').text())
        .toBe('vs Oct')
    })

  it('lists every Category by spend with its change',
    async () => {
      const { wrapper } = await mountWidget()

      expect(rowTexts(wrapper)).toEqual([
        ['Equipment', 'R$16,000.00', 'new'],
        ['Food', 'R$840.00', '↑32%'],
        ['Cats', 'R$400.00', '0%'],
        ['Taxes', 'R$0.00', '↓100%']
      ])
    })

  it('colours rises, falls and the rest', async () => {
    const { wrapper } = await mountWidget()
    const tones = wrapper.findAll('.change')
      .map(change => change.attributes('data-tone'))

    expect(tones).toEqual(['muted', 'rise', 'muted', 'fall'])
  })

  it('draws bars on a square-root scale', async () => {
    const { wrapper } = await mountWidget([
      tx(1, '2026-11-03', -40_000),
      tx(2, '2026-11-04', -10_000),
      tx(4, '2026-10-06', -10_000)
    ])
    const bars = wrapper.findAll('.row').map(row =>
      row.find('.bar').exists()
        ? (row.get('.bar').element as HTMLElement)
            .style.width
        : null)

    expect(bars).toEqual(['100%', '50%', null])
  })

  it('highlights the largest Categories’ bars',
    async () => {
      const { wrapper } = await mountWidget([
        tx(1, '2026-11-03', -40_000),
        tx(2, '2026-11-04', -40_000),
        tx(3, '2026-11-05', -10_000)
      ])
      const top = wrapper.findAll('.bar')
        .map(bar => bar.classes('-top'))

      expect(top).toEqual([true, true, false])
    })

  it('scrolls the rows with the overlay scrollbar',
    async () => {
      const { wrapper } = await mountWidget()

      expect(
        wrapper.find('.view > .rows + .overlay-scrollbar')
          .exists()
      ).toBe(true)
      expect(wrapper.get('.note').text())
        .toBe('Bar length on a square-root scale')
    })

  it('says when there is no spend in either period',
    async () => {
      const { wrapper } = await mountWidget(
        [tx(5, '2026-11-02', 500_000)]
      )

      expect(wrapper.get('.message').text())
        .toBe('No spending this month')
      expect(wrapper.find('.rows').exists()).toBe(false)
      expect(wrapper.find('.note').exists()).toBe(false)
    })

  it('says when loading fails', async () => {
    const { wrapper } = await mountWidget(
      [], { ok: false, error: { code: 'internal' } }
    )

    expect(wrapper.get('[role="alert"]').text())
      .toBe('Couldn’t load By Category.')
    expect(wrapper.find('.rows').exists()).toBe(false)
  })

  it('reloads when the Selected Date changes',
    async () => {
      const { wrapper, api, store } = await mountWidget()

      store.setDay(new Date(2026, 2, 31))
      await flushPromises()

      expect(api.expenses.list).toHaveBeenLastCalledWith(
        { from: '2026-02-01', to: '2026-03-31' }
      )
      expect(wrapper.get('.versus').text()).toBe('vs Feb')
    })

  it('reloads when a Transaction is written', async () => {
    const { wrapper, api } = await mountWidget([])
    expect(wrapper.find('.message').exists()).toBe(true)

    vi.mocked(api.expenses.list).mockResolvedValue({
      ok: true,
      value: [tx(2, '2026-11-04', -84_000)]
    })
    await api.expenses.create({
      date: '2026-11-04',
      description: 'Lunch',
      categoryId: 2,
      amount: -84_000
    })
    await flushPromises()

    expect(rowTexts(wrapper)).toEqual([
      ['Food', 'R$840.00', 'new']
    ])
  })

  it('reloads when a Category is created', async () => {
    const { api } = await mountWidget()
    const calls = vi.mocked(api.expenses.listCategories)
      .mock.calls.length

    await api.expenses.createCategory('Gifts')
    await flushPromises()

    expect(
      vi.mocked(api.expenses.listCategories).mock.calls
    ).toHaveLength(calls + 1)
  })
})
