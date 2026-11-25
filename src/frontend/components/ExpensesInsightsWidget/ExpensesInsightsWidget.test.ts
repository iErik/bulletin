import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BulletinApi } from '@shared/bridge'
import type {
  Budget,
  Category,
  Transaction
} from '@shared/expenses'
import type { MoodEntry } from '@shared/mood'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import ExpensesInsightsWidget
  from './ExpensesInsightsWidget.vue'

// Today is Monday, Nov 9th 2026: the period is Nov 1–9,
// with Sat 7th and Sun 1st and 8th as its weekend days,
// and the comparison period is Oct 1–9.

let widget: VueWrapper | undefined

const FOOD: Category = { id: 1, name: 'Food' }
const TECH: Category = { id: 2, name: 'Tech' }

const tx = (
  id: number,
  date: string,
  amount: number,
  description = 'Groceries',
  categoryId = FOOD.id
): Transaction => ({ id, date, description, categoryId, amount })

const BUDGET: Budget = { month: '2026-11', amount: 2_400_000 }

const SAMPLE: Transaction[] = [
  tx(1, '2026-10-03', -50_000),
  tx(2, '2026-11-01', 2_000_000, 'Salary'),
  tx(3, '2026-11-02', -100_000),
  tx(4, '2026-11-07', -1_299_300, 'MPB M5', TECH.id)
]

const MOODS: MoodEntry[] = [
  { date: '2026-11-02', mood: 'happy' },
  { date: '2026-11-07', mood: 'stressed' }
]

const mountWidget = async (options: {
  transactions?: Transaction[]
  budget?: Budget | null
  moods?: MoodEntry[]
} = {}): Promise<{
  wrapper: VueWrapper
  api: BulletinApi
}> => {
  const {
    transactions = SAMPLE,
    budget = BUDGET,
    moods = MOODS
  } = options
  const api = stubBulletin()
  vi.mocked(api.expenses.list).mockResolvedValue(
    { ok: true, value: transactions }
  )
  vi.mocked(api.expenses.getBudget).mockResolvedValue(
    { ok: true, value: budget }
  )
  vi.mocked(api.expenses.listCategories).mockResolvedValue(
    { ok: true, value: [FOOD, TECH] }
  )
  vi.mocked(api.mood.list).mockResolvedValue(
    { ok: true, value: moods }
  )
  const pinia = createPinia()
  setActivePinia(pinia)
  widget = mount(ExpensesInsightsWidget, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  await flushPromises()
  return { wrapper: widget, api }
}

/** Each row as [label, caption, value, tone]. */
const rowsOf = (wrapper: VueWrapper): string[][] =>
  wrapper.findAll('.row').map(row => [
    row.get('.label').text(),
    row.get('.caption').text(),
    row.get('.value').text(),
    row.attributes('data-tone') ?? ''
  ])

describe('ExpensesInsightsWidget', () => {
  useFixedToday()

  afterEach(() => {
    widget?.unmount()
    widget = undefined
    document.body.innerHTML = ''
  })

  it('shows its title and "This month"', async () => {
    const { wrapper } = await mountWidget()

    expect(wrapper.get('.title').text()).toBe('Insights')
    expect(wrapper.get('.actions .subtitle').text())
      .toBe('This month')
  })

  it('loads both periods, the Budget, Categories and Moods',
    async () => {
      const { api } = await mountWidget()

      expect(api.expenses.list).toHaveBeenCalledWith(
        { from: '2026-10-01', to: '2026-11-09' }
      )
      expect(api.expenses.getBudget)
        .toHaveBeenCalledWith('2026-11')
      expect(api.expenses.listCategories).toHaveBeenCalled()
      expect(api.mood.list).toHaveBeenCalledWith(
        { from: '2026-11-01', to: '2026-11-09' }
      )
    })

  it('draws the five rows in order', async () => {
    const { wrapper } = await mountWidget()

    expect(rowsOf(wrapper)).toEqual([
      ['Food', 'vs Oct', '↑100%', 'bad'],
      ['Weekends', 'vs weekdays', '26.0× more', 'neutral'],
      ['Savings rate', 'income − expenses', '30%', 'good'],
      ['Without MPB M5', 'budget used', '4%', 'neutral'],
      [
        'Stressed days', 'avg extra spend',
        '+R$11,993.00', 'stressed'
      ]
    ])
    expect(wrapper.findAll('.row .dot')).toHaveLength(1)
    expect(wrapper.find('.row[data-kind="stressed"] .dot')
      .exists()).toBe(true)
  })

  it('hides rows it cannot compute, keeping the order',
    async () => {
      const { wrapper } = await mountWidget({
        transactions: SAMPLE.filter(t => t.amount < 0),
        budget: null,
        moods: []
      })

      expect(rowsOf(wrapper).map(([label]) => label))
        .toEqual(['Food', 'Weekends'])
    })

  it('counts the other Large Expenses in the label',
    async () => {
      const { wrapper } = await mountWidget({
        transactions: [
          ...SAMPLE,
          tx(5, '2026-11-03', -700_000, 'Rent')
        ]
      })

      expect(wrapper.get('.row[data-kind="without"] .label')
        .text()).toBe('Without MPB M5 +1')
    })

  it('shows falls and savings shortfalls in their colours',
    async () => {
      const { wrapper } = await mountWidget({
        transactions: [
          tx(1, '2026-10-03', -200_000),
          tx(2, '2026-11-01', 50_000, 'Salary'),
          tx(3, '2026-11-02', -100_000)
        ]
      })

      expect(rowsOf(wrapper)[0].slice(2))
        .toEqual(['↓50%', 'good'])
      expect(rowsOf(wrapper)[1].slice(2))
        .toEqual(['−100%', 'bad'])
    })

  it('shows an unchanged Category as a neutral 0%',
    async () => {
      const { wrapper } = await mountWidget({
        transactions: [
          tx(1, '2026-10-03', -100_000),
          tx(3, '2026-11-02', -100_000)
        ],
        moods: []
      })

      expect(rowsOf(wrapper)[0].slice(2))
        .toEqual(['0%', 'neutral'])
    })

  it('says when there is no spending this month',
    async () => {
      const { wrapper } = await mountWidget({
        transactions: [],
        moods: []
      })

      expect(wrapper.find('.rows').exists()).toBe(false)
      expect(wrapper.get('.message').text())
        .toBe('No spending this month')
    })

  it('says when spend gives no insights yet', async () => {
    const { wrapper } = await mountWidget({
      transactions: [
        tx(3, '2026-11-02', -100_000, 'Laptop', TECH.id)
      ],
      budget: null,
      moods: []
    })

    expect(wrapper.find('.rows').exists()).toBe(false)
    expect(wrapper.get('.message').text())
      .toBe('No insights yet')
  })

  it('reports a failed load', async () => {
    const api = stubBulletin()
    vi.mocked(api.mood.list).mockResolvedValue(
      { ok: false, error: { code: 'internal' } }
    )
    const pinia = createPinia()
    setActivePinia(pinia)
    widget = mount(ExpensesInsightsWidget, {
      global: { plugins: [pinia] }
    })
    await flushPromises()

    expect(widget.get('[role="alert"]').text())
      .toBe('Couldn’t load Insights.')
    expect(widget.find('.rows').exists()).toBe(false)
  })

  it('reloads when the Selected Date changes', async () => {
    const { api } = await mountWidget()

    useSelectedDateStore().setDay(new Date(2026, 2, 31))
    await flushPromises()

    expect(api.expenses.list).toHaveBeenLastCalledWith(
      { from: '2026-02-01', to: '2026-03-31' }
    )
    expect(api.expenses.getBudget)
      .toHaveBeenLastCalledWith('2026-03')
  })

  it('reloads after Transaction and Mood writes',
    async () => {
      const { api } = await mountWidget()
      const loads = (): number =>
        vi.mocked(api.expenses.list).mock.calls.length

      const before = loads()
      await api.expenses.create({
        date: '2026-11-03',
        description: 'Lunch',
        categoryId: FOOD.id,
        amount: -3_000
      })
      await flushPromises()
      expect(loads()).toBe(before + 1)

      await api.mood.create(
        { date: '2026-11-03', mood: 'okay' }
      )
      await flushPromises()
      expect(loads()).toBe(before + 2)
    })

  it('drops a load a newer one overtook', async () => {
    const { wrapper, api } = await mountWidget()
    let release: () => void = () => {}
    vi.mocked(api.expenses.list).mockImplementationOnce(
      () => new Promise(resolve => {
        release = () => resolve({ ok: true, value: [] })
      })
    )
    const store = useSelectedDateStore()
    store.setDay(new Date(2026, 9, 9))
    await flushPromises()
    store.setDay(new Date(2026, 10, 9))
    await flushPromises()
    release()
    await flushPromises()

    expect(wrapper.findAll('.row')).toHaveLength(5)
  })
})
