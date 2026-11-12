import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type DOMWrapper,
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

const TODAY = new Date(2026, 10, 12)

const mountTable = (
  transactions = TRANSACTIONS
): VueWrapper => table = mount(ExpenseTable, {
  attachTo: document.body,
  props: {
    transactions,
    categories: [{ id: 1, name: 'Food' }],
    today: TODAY
  }
})

/** Opens the row's description or value input. */
const edit = async (
  wrapper: VueWrapper,
  text: string
): Promise<DOMWrapper<HTMLInputElement>> => {
  const button = wrapper.findAll('tbody .cell-input > .value')
    .find(el => el.text() === text)
  await button?.trigger('click')
  await flushPromises()
  return wrapper.find<HTMLInputElement>('tbody input')
}

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

  it('lets each cell be reached from the keyboard', () => {
    const wrapper = mountTable()
    const first = wrapper.get('tbody > tr')

    expect(first.findAll('button, [tabindex="0"]')
      .map(el => el.text()))
      .toEqual(['', 'Salary', 'Food', 'Nov 3', 'R$25,000.00'])
  })

  it('picks another Category for a row', async () => {
    const api = stubBulletin()
    const wrapper = mountTable([TRANSACTIONS[1]])
    await wrapper.setProps({
      categories: [
        { id: 1, name: 'Food' },
        { id: 2, name: 'Pay' }
      ]
    })

    await wrapper.get('tbody .chip').trigger('click')
    await flushPromises()
    await wrapper.get('.field').setValue('pay')
    await wrapper.get('.field')
      .trigger('keydown', { key: 'Enter' })
    await flushPromises()

    const saved = { ...TRANSACTIONS[1], categoryId: 2 }
    expect(api.expenses.createCategory).not.toHaveBeenCalled()
    expect(api.expenses.update).toHaveBeenCalledWith(saved)
    expect(wrapper.emitted('updated')).toEqual([[saved]])
  })

  it('creates a Category nothing matches', async () => {
    const api = stubBulletin()
    vi.mocked(api.expenses.createCategory).mockResolvedValue(
      { ok: true, value: { id: 7, name: 'Gym' } }
    )
    const wrapper = mountTable([TRANSACTIONS[1]])

    await wrapper.get('tbody .chip').trigger('click')
    await flushPromises()
    await wrapper.get('.field').setValue(' Gym ')
    await wrapper.get('.field')
      .trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(api.expenses.createCategory)
      .toHaveBeenCalledWith('Gym')
    expect(wrapper.emitted('category-created'))
      .toEqual([[{ id: 7, name: 'Gym' }]])
    expect(api.expenses.update).toHaveBeenCalledWith(
      { ...TRANSACTIONS[1], categoryId: 7 }
    )
  })

  it.each([
    ['createCategory', 'Gym', 'Couldn’t create the Category. Try again.'],
    ['update', 'Gym', 'Couldn’t save the change. Try again.']
  ] as const)(
    'shows an inline error when %s fails',
    async (method, name, message) => {
      const api = stubBulletin()
      vi.mocked(api.expenses.createCategory).mockResolvedValue(
        { ok: true, value: { id: 7, name } }
      )
      vi.mocked(api.expenses[method]).mockResolvedValue(
        { ok: false, error: { code: 'internal' } }
      )
      const wrapper = mountTable([TRANSACTIONS[1]])

      await wrapper.get('tbody .chip').trigger('click')
      await flushPromises()
      await wrapper.get('.field').setValue(name)
      await wrapper.get('.field')
        .trigger('keydown', { key: 'Enter' })
      await flushPromises()

      expect(wrapper.emitted('updated')).toBeUndefined()
      expect(wrapper.get('tbody .chip').text()).toBe('Food')
      expect(wrapper.get('[role="alert"]').text())
        .toBe(message)
    }
  )

  it('saves an edited description', async () => {
    const api = stubBulletin()
    const wrapper = mountTable()

    const input = await edit(wrapper, 'Salary')
    await input.setValue('  Bonus ')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    const saved = { ...TRANSACTIONS[1], description: 'Bonus' }
    expect(api.expenses.update).toHaveBeenCalledWith(saved)
    expect(wrapper.emitted('updated')).toEqual([[saved]])
  })

  it('parses an edited value', async () => {
    const api = stubBulletin()
    const wrapper = mountTable()

    const input = await edit(wrapper, '-R$30.00')
    expect(input.element.value).toBe('-30.00')
    await input.setValue('-1.234,56')
    await input.trigger('blur')
    await flushPromises()

    expect(api.expenses.update).toHaveBeenCalledWith(
      { ...TRANSACTIONS[3], amount: -123_456 }
    )
  })

  it('doesn’t save an unchanged value', async () => {
    const api = stubBulletin()
    const wrapper = mountTable()

    const input = await edit(wrapper, 'R$25,000.00')
    await input.setValue('25,000.00')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(api.expenses.update).not.toHaveBeenCalled()
  })

  it.each([
    ['R$25,000.00', 'abc', 'Enter an amount like -1234.56.'],
    ['Salary', ' ', 'Enter a description.']
  ])(
    'keeps %j open on invalid %j, with an error',
    async (cell, text, reason) => {
      const api = stubBulletin()
      const wrapper = mountTable()

      const input = await edit(wrapper, cell)
      await input.setValue(text)
      await input.trigger('keydown', { key: 'Enter' })
      await flushPromises()

      expect(api.expenses.update).not.toHaveBeenCalled()
      expect(wrapper.get('[role="alert"]').text())
        .toBe(reason)
      expect(input.attributes('aria-invalid')).toBe('true')
    }
  )

  it('shows an edit while saving it', async () => {
    const api = stubBulletin()
    vi.mocked(api.expenses.update)
      .mockReturnValueOnce(new Promise(() => {}))
    const wrapper = mountTable()

    const input = await edit(wrapper, 'Salary')
    await input.setValue('Bonus')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(cells(wrapper)[0][1]).toBe('Bonus')
  })

  it('reverts and shows a storage error', async () => {
    const api = stubBulletin()
    vi.mocked(api.expenses.update).mockResolvedValue(
      { ok: false, error: { code: 'internal' } }
    )
    const wrapper = mountTable()

    const input = await edit(wrapper, 'Salary')
    await input.setValue('Bonus')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(cells(wrapper)[0][1]).toBe('Salary')
    expect(wrapper.emitted('updated')).toBeUndefined()
    expect(wrapper.get('[role="alert"]').text())
      .toBe('Couldn’t save the change. Try again.')
  })

  it('saves a new date from the popover', async () => {
    const api = stubBulletin()
    const wrapper = mountTable()

    await wrapper.get('tbody .date-cell > .value')
      .trigger('click')
    await flushPromises()
    await wrapper.get('select[aria-label="Day"]')
      .setValue('5')
    await wrapper.get('select[aria-label="Day"]')
      .trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(api.expenses.update).toHaveBeenCalledWith(
      { ...TRANSACTIONS[1], date: '2026-11-05' }
    )
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

  it('drops the error when a reload drops the row',
    async () => {
      const api = stubBulletin()
      vi.mocked(api.expenses.delete).mockResolvedValue(
        { ok: false, error: { code: 'internal' } }
      )
      const wrapper = mountTable()

      await ask(wrapper, 'Salary')
      await wrapper.get('.-confirm').trigger('click')
      await flushPromises()
      await wrapper.setProps({
        transactions: [TRANSACTIONS[0]]
      })

      expect(asking(wrapper)).toEqual([])
      expect(wrapper.find('[role="alert"]').exists())
        .toBe(false)
    })

  it('treats a Transaction already gone as deleted',
    async () => {
      const api = stubBulletin()
      vi.mocked(api.expenses.delete).mockResolvedValue(
        { ok: false, error: { code: 'not-found' } }
      )
      const wrapper = mountTable()

      await ask(wrapper, 'Salary')
      await wrapper.get('.-confirm').trigger('click')
      await flushPromises()

      expect(wrapper.emitted('deleted'))
        .toEqual([[TRANSACTIONS[1]]])
      expect(asking(wrapper)).toEqual([])
      expect(wrapper.find('[role="alert"]').exists())
        .toBe(false)
    })

  it('focuses the table after deleting the last row',
    async () => {
      stubBulletin()
      const only = [TRANSACTIONS[1]]
      const wrapper: VueWrapper = table = mount(
        ExpenseTable,
        {
          attachTo: document.body,
          props: {
            transactions: only,
            categories: [{ id: 1, name: 'Food' }],
            today: TODAY,
            // Like the Widget, drop it once deleted.
            onDeleted: () =>
              void wrapper.setProps({ transactions: [] })
          }
        }
      )

      await ask(wrapper, 'Salary')
      await wrapper.get('.-confirm').trigger('click')
      await flushPromises()

      expect(wrapper.findAll('tbody > tr')).toHaveLength(0)
      expect(document.activeElement)
        .toBe(wrapper.get('.table').element)
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
