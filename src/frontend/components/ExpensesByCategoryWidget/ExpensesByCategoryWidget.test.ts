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

const CATEGORIES: Category[] =
  ['Equipment', 'Food', 'Cats', 'Taxes', 'Rent']
    .map((name, index) => ({ id: index + 1, name }))

let nextId = 1

const tx = (
  categoryId: number,
  date: string,
  amount: number
): Transaction => ({
  id: nextId++, date, categoryId, amount, description: 'Spend'
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

// Holds the next list till the returned call resolves it.
const holdList = (api: BulletinApi): (() => void) => {
  let finish = (): void => {}
  vi.mocked(api.expenses.list).mockImplementationOnce(
    () => new Promise(done => {
      finish = () => done({ ok: true, value: SAMPLE })
    }))
  return () => finish()
}

describe('ExpensesByCategoryWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('loads both periods and compares with last month',
    async () => {
      const { wrapper, api } = await mountWidget()

      expect(api.expenses.list).toHaveBeenCalledWith(
        { from: '2026-10-01', to: '2026-11-09' }
      )
      expect(api.expenses.listCategories).toHaveBeenCalled()
      expect(wrapper.get('.title').text())
        .toBe('By Category')
      expect(wrapper.get('.actions > .versus').text())
        .toBe('vs Oct')
    })

  it('lists and colours every Category’s change',
    async () => {
      const { wrapper } = await mountWidget()
      const tones = wrapper.findAll('.change')
        .map(change => change.attributes('data-tone'))

      expect(rowTexts(wrapper)).toEqual([
        ['Equipment', 'R$16,000.00', 'new'],
        ['Food', 'R$840.00', '↑32%'],
        ['Cats', 'R$400.00', '0%'],
        ['Taxes', 'R$0.00', '↓100%']
      ])
      expect(tones).toEqual(['muted', 'rise', 'muted', 'fall'])
    })

  it('draws square-root bars, highlighting the largest',
    async () => {
      const { wrapper } = await mountWidget([
        tx(1, '2026-11-03', -40_000),
        tx(2, '2026-11-04', -40_000),
        tx(3, '2026-11-05', -10_000),
        tx(4, '2026-10-06', -10_000)
      ])
      const bars = wrapper.findAll('.row').map(row =>
        row.find('.bar').exists()
          ? (row.get('.bar').element as HTMLElement)
              .style.width
          : null)
      const top = wrapper.findAll('.bar')
        .map(bar => bar.classes('-top'))

      expect(bars).toEqual(['100%', '100%', '50%', null])
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

  it('reloads when the Selected Date changes', async () => {
    const { wrapper, api, store } = await mountWidget()

    store.setDay(new Date(2026, 2, 31))
    await flushPromises()

    expect(api.expenses.list).toHaveBeenLastCalledWith(
      { from: '2026-02-01', to: '2026-03-31' }
    )
    expect(wrapper.get('.versus').text()).toBe('vs Feb')
  })

  it('keeps old rows till the new day loads', async () => {
    const { wrapper, api, store } = await mountWidget()
    const before = rowTexts(wrapper)
    holdList(api)

    store.setDay(new Date(2026, 8, 3))
    await flushPromises()

    expect(rowTexts(wrapper)).toEqual(before)
    expect(wrapper.get('.versus').text()).toBe('vs Oct')
  })

  it('drops a load a newer one overtook', async () => {
    const { wrapper, api, store } = await mountWidget([])
    const finish = holdList(api)

    store.setDay(new Date(2026, 9, 9))
    await flushPromises()
    store.setDay(new Date(2026, 10, 8))
    await flushPromises()
    finish()
    await flushPromises()

    expect(wrapper.find('.rows').exists()).toBe(false)
    expect(wrapper.get('.versus').text()).toBe('vs Oct')
  })

  it('reloads when a Transaction is written', async () => {
    const { wrapper, api } = await mountWidget([])
    expect(wrapper.find('.message').exists()).toBe(true)

    vi.mocked(api.expenses.list).mockResolvedValue({
      ok: true, value: [tx(2, '2026-11-04', -84_000)]
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
    const { calls } = vi.mocked(api.expenses.listCategories).mock
    const before = calls.length

    await api.expenses.createCategory('Gifts')
    await flushPromises()

    expect(calls).toHaveLength(before + 1)
  })
})
