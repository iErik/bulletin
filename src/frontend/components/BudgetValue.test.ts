import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import type { BulletinApi } from '@shared/bridge'
import type { Budget } from '@shared/expenses'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import BudgetValue from './BudgetValue.vue'

const NOVEMBER = new Date(2026, 10, 1)
const OWN: Budget = { month: '2026-11', amount: 300_000 }
const CARRIED: Budget = { month: '2026-08', amount: 300_000 }

let value: VueWrapper | undefined

/** Mounts it and opens the input. */
const mountOpen = async (
  budget: Budget | null = OWN
): Promise<{ wrapper: VueWrapper; api: BulletinApi }> => {
  const api = stubBulletin()
  value = mount(BudgetValue, {
    attachTo: document.body,
    props: { budget, month: NOVEMBER }
  })
  await value.get('button').trigger('click')
  await flushPromises()
  return { wrapper: value, api }
}

const input = (
  wrapper: VueWrapper
): DOMWrapper<HTMLInputElement> =>
  wrapper.find<HTMLInputElement>('input')

const press = async (
  wrapper: VueWrapper,
  key: string
): Promise<void> => {
  await input(wrapper).trigger('keydown', { key })
  await flushPromises()
}

const type = async (
  wrapper: VueWrapper,
  text: string,
  key = 'Enter'
): Promise<void> => {
  await input(wrapper).setValue(text)
  await press(wrapper, key)
}

const alert = (wrapper: VueWrapper): string =>
  wrapper.get('[role="alert"]').text()

describe('BudgetValue', () => {
  useFixedToday()

  afterEach(() => {
    value?.unmount()
    value = undefined
  })

  it('opens on the value, as a plain number', async () => {
    const { wrapper } = await mountOpen()

    expect(input(wrapper).element.value).toBe('3000.00')
    expect(document.activeElement)
      .toBe(input(wrapper).element)
  })

  it('opens empty on the dash', async () => {
    const { wrapper } = await mountOpen(null)

    expect(input(wrapper).element.value).toBe('')
  })

  it('saves this month’s Budget on Enter', async () => {
    const { wrapper, api } = await mountOpen(CARRIED)

    await type(wrapper, '1.234,56')

    expect(api.expenses.setBudget).toHaveBeenCalledWith(
      { month: '2026-11', amount: 123_456 }
    )
    expect(wrapper.emitted('saved')).toEqual([
      [{ month: '2026-11', amount: 123_456 }]
    ])
    expect(input(wrapper).exists()).toBe(false)
    expect(document.activeElement)
      .toBe(wrapper.get('button').element)
  })

  it('saves on clicking away', async () => {
    const { wrapper, api } = await mountOpen(null)

    await input(wrapper).setValue('30,5')
    await input(wrapper).trigger('blur')
    await flushPromises()

    expect(api.expenses.setBudget).toHaveBeenCalledWith(
      { month: '2026-11', amount: 3_050 }
    )
    expect(input(wrapper).exists()).toBe(false)
  })

  it('closes untouched on clicking away', async () => {
    const { wrapper, api } = await mountOpen(CARRIED)

    await input(wrapper).trigger('blur')
    await flushPromises()

    expect(api.expenses.setBudget).not.toHaveBeenCalled()
    expect(input(wrapper).exists()).toBe(false)
  })

  it('doesn’t resave an unchanged own Budget', async () => {
    const { wrapper, api } = await mountOpen()

    await type(wrapper, '3,000.00')

    expect(api.expenses.setBudget).not.toHaveBeenCalled()
    expect(input(wrapper).exists()).toBe(false)
  })

  it('cancels on Escape', async () => {
    const { wrapper, api } = await mountOpen()

    await type(wrapper, '99', 'Escape')

    expect(api.expenses.setBudget).not.toHaveBeenCalled()
    expect(wrapper.get('button').text())
      .toBe('R$3,000.00')
    expect(document.activeElement)
      .toBe(wrapper.get('button').element)
  })

  it.each([
    ['abc', 'Enter an amount like 1234.56.'],
    ['', 'Enter an amount like 1234.56.'],
    ['-30', 'The Budget can’t be negative.']
  ])(
    'keeps %j open with an error on Enter',
    async (text, error) => {
      const { wrapper, api } = await mountOpen()

      await type(wrapper, text)

      expect(api.expenses.setBudget).not.toHaveBeenCalled()
      expect(alert(wrapper)).toBe(error)
      expect(input(wrapper).attributes('aria-invalid'))
        .toBe('true')
    }
  )

  it('clears the error on typing', async () => {
    const { wrapper } = await mountOpen()

    await type(wrapper, 'abc')
    await input(wrapper).setValue('30')

    expect(wrapper.find('[role="alert"]').exists())
      .toBe(false)
  })

  it('reverts an invalid amount on clicking away', async () => {
    const { wrapper, api } = await mountOpen()

    await input(wrapper).setValue('-30')
    await input(wrapper).trigger('blur')
    await flushPromises()

    expect(api.expenses.setBudget).not.toHaveBeenCalled()
    expect(wrapper.get('button').text())
      .toBe('R$3,000.00')
    expect(alert(wrapper))
      .toBe('The Budget can’t be negative.')
  })

  it('reverts and shows a storage error', async () => {
    const { wrapper, api } = await mountOpen()
    vi.mocked(api.expenses.setBudget).mockResolvedValue(
      { ok: false, error: { code: 'internal' } }
    )

    await type(wrapper, '50')

    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.get('button').text())
      .toBe('R$3,000.00')
    expect(alert(wrapper))
      .toBe('Couldn’t save the Budget.')
  })

  it('holds while saving', async () => {
    const { wrapper, api } = await mountOpen()
    let finish = (): void => {}
    vi.mocked(api.expenses.setBudget)
      .mockImplementationOnce(budget =>
        new Promise(done => {
          finish = () => done({ ok: true, value: budget })
        }))

    await type(wrapper, '50')
    await press(wrapper, 'Escape')
    await press(wrapper, 'Enter')
    await input(wrapper).trigger('blur')

    expect(input(wrapper).attributes('readonly'))
      .toBeDefined()
    expect(api.expenses.setBudget).toHaveBeenCalledOnce()
    finish()
    await flushPromises()
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(input(wrapper).exists()).toBe(false)
  })
})
