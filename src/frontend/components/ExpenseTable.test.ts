import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { Transaction } from '@shared/expenses'
import ExpenseTable from './ExpenseTable.vue'

let table: VueWrapper | undefined

const row = (
  id: number,
  date: string,
  description: string,
  amount: number
): Transaction =>
  ({ id, date, description, categoryId: 1, amount })

const TRANSACTIONS = [
  row(3, '2026-11-12', 'Cat food', -10_245),
  row(1, '2026-11-03', 'Salary', 2_500_000),
  row(4, '2026-11-12', 'Refund', 0),
  row(2, '2026-11-12', 'Cigarettes', -3000)
]

const mountTable = (): VueWrapper =>
  table = mount(ExpenseTable, {
    props: {
      transactions: TRANSACTIONS,
      categories: [{ id: 1, name: 'Food' }]
    }
  })

/** Each body row's cells' text. */
const cells = (wrapper: VueWrapper): string[][] =>
  wrapper.findAll('tbody > tr').map(tr =>
    tr.findAll('td').map(td => td.text()))

describe('ExpenseTable', () => {
  afterEach(() => {
    table?.unmount()
    table = undefined
  })

  it('has the columns, with no TYPE', () => {
    const wrapper = mountTable()

    expect(wrapper.findAll('th').map(th => th.text()))
      .toEqual(['', 'Desc', 'Category', 'Date', 'Value'])
  })

  it('orders rows by date, then as added', () => {
    const wrapper = mountTable()

    expect(cells(wrapper)).toEqual([
      ['1', 'Salary', 'Food', 'Nov 3', 'R$25,000.00'],
      ['2', 'Cigarettes', 'Food', 'Nov 12', '-R$30.00'],
      ['3', 'Cat food', 'Food', 'Nov 12', '-R$102.45'],
      ['4', 'Refund', 'Food', 'Nov 12', 'R$0.00']
    ])
  })

  it('colours each value by its sign', () => {
    const wrapper = mountTable()

    expect(wrapper.findAll('td.value')
      .map(td => td.classes().at(-1)))
      .toEqual(['-income', '-expense', '-expense', '-zero'])
  })

  it('lets the cut-off text be focused', () => {
    const wrapper = mountTable()
    const first = wrapper.get('tbody > tr')

    expect(first.findAll('[tabindex="0"]')
      .map(el => el.text()))
      .toEqual(['Salary', 'Food'])
  })
})
