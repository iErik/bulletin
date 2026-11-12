import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import type { Transaction } from '@shared/expenses'
import { stubBulletin } from '@/testing/bulletin'
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

const mountTable = (
  transactions = TRANSACTIONS
): VueWrapper => table = mount(ExpenseTable, {
  attachTo: document.body,
  props: {
    transactions,
    categories: [{ id: 1, name: 'Food' }]
  }
})

/** Each body row's cells' text. */
const cells = (wrapper: VueWrapper): string[][] =>
  wrapper.findAll('tbody > tr').map(tr =>
    tr.findAll('td').map(td => td.text()))

/** Clicks "−" on the row for `description`. */
const ask = async (
  wrapper: VueWrapper,
  description: string
): Promise<void> => {
  await wrapper
    .get(`[aria-label="Delete ${description}"]`)
    .trigger('click')
}

const asking = (wrapper: VueWrapper): string[] =>
  wrapper.findAll('.controls').map(controls =>
    controls.attributes('aria-label') ?? '')

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
    stubBulletin()
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

  it('asks “Delete?”, focusing ✓', async () => {
    stubBulletin()
    const wrapper = mountTable()

    await ask(wrapper, 'Salary')
    await flushPromises()

    expect(asking(wrapper)).toEqual(['Delete Salary?'])
    expect(document.activeElement)
      .toBe(wrapper.get('.-confirm').element)
  })

  it('deletes on ✓ and emits it', async () => {
    const api = stubBulletin()
    const wrapper = mountTable()

    await ask(wrapper, 'Salary')
    await wrapper.get('.-confirm').trigger('click')
    await flushPromises()

    expect(api.expenses.delete).toHaveBeenCalledWith(1)
    expect(wrapper.emitted('deleted'))
      .toEqual([[TRANSACTIONS[1]]])
    expect(asking(wrapper)).toEqual([])
  })

  it('cancels on ×, refocusing “−”', async () => {
    const api = stubBulletin()
    const wrapper = mountTable()

    await ask(wrapper, 'Salary')
    await wrapper.get('[aria-label="Don’t delete"]')
      .trigger('click')
    await flushPromises()

    expect(asking(wrapper)).toEqual([])
    expect(api.expenses.delete).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(wrapper
      .get('[aria-label="Delete Salary"]').element)
  })

  it('cancels on Escape', async () => {
    stubBulletin()
    const wrapper = mountTable()

    await ask(wrapper, 'Salary')
    await wrapper.get('.-confirm')
      .trigger('keydown', { key: 'Escape' })

    expect(asking(wrapper)).toEqual([])
  })

  it.each(['pointerdown', 'focusin'])(
    'cancels on %s elsewhere',
    async event => {
      stubBulletin()
      const wrapper = mountTable()

      await ask(wrapper, 'Salary')
      document.body.dispatchEvent(
        new Event(event, { bubbles: true })
      )
      await flushPromises()

      expect(asking(wrapper)).toEqual([])
    }
  )

  it('asks for one row at a time', async () => {
    stubBulletin()
    const wrapper = mountTable()

    await ask(wrapper, 'Salary')
    await ask(wrapper, 'Refund')

    expect(asking(wrapper)).toEqual(['Delete Refund?'])
  })

  it('keeps asking, with an error, if it fails', async () => {
    const api = stubBulletin()
    vi.mocked(api.expenses.delete).mockResolvedValue(
      { ok: false, error: { code: 'internal' } }
    )
    const wrapper = mountTable()

    await ask(wrapper, 'Salary')
    await wrapper.get('.-confirm').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text())
      .toBe('Couldn’t delete the Transaction. Try again.')
    expect(asking(wrapper)).toEqual(['Delete Salary?'])
    expect(wrapper.emitted('deleted')).toBeUndefined()
  })

  it('holds ✓ and × while deleting', async () => {
    const api = stubBulletin()
    vi.mocked(api.expenses.delete)
      .mockReturnValue(new Promise(() => {}))
    const wrapper = mountTable()

    await ask(wrapper, 'Salary')
    await wrapper.get('.-confirm').trigger('click')
    await wrapper.get('[aria-label="Don’t delete"]')
      .trigger('click')

    expect(wrapper.get('.-confirm').attributes())
      .toHaveProperty('disabled')
    expect(asking(wrapper)).toEqual(['Delete Salary?'])
  })
})
