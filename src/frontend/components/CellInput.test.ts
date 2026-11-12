import { afterEach, describe, expect, it } from 'vitest'
import {
  type DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import CellInput from './CellInput.vue'

let cell: VueWrapper | undefined

/** Mounts it and opens the input. */
const mountOpen = async (): Promise<VueWrapper> => {
  cell = mount(CellInput, {
    attachTo: document.body,
    props: {
      text: 'R$30.00',
      start: '30.00',
      label: 'Value',
      check: (text: string) =>
        text === 'bad' ? 'Not an amount.' : null
    }
  })
  await cell.get('button').trigger('click')
  await flushPromises()
  return cell
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

describe('CellInput', () => {
  afterEach(() => {
    cell?.unmount()
    cell = undefined
  })

  it('opens on `start`, focused', async () => {
    const wrapper = await mountOpen()

    expect(input(wrapper).element.value).toBe('30.00')
    expect(input(wrapper).attributes('aria-label'))
      .toBe('Value')
    expect(document.activeElement)
      .toBe(input(wrapper).element)
  })

  it('commits on Enter, refocusing the value', async () => {
    const wrapper = await mountOpen()

    await input(wrapper).setValue('45')
    await press(wrapper, 'Enter')

    expect(wrapper.emitted('commit')).toEqual([['45']])
    expect(input(wrapper).exists()).toBe(false)
    expect(document.activeElement)
      .toBe(wrapper.get('button').element)
  })

  it('commits on clicking away', async () => {
    const wrapper = await mountOpen()

    await input(wrapper).setValue('45')
    await input(wrapper).trigger('blur')

    expect(wrapper.emitted('commit')).toEqual([['45']])
    expect(input(wrapper).exists()).toBe(false)
  })

  it('reverts on Escape', async () => {
    const wrapper = await mountOpen()

    await input(wrapper).setValue('45')
    await press(wrapper, 'Escape')

    expect(wrapper.emitted('commit')).toBeUndefined()
    expect(wrapper.get('button').text()).toBe('R$30.00')
    expect(document.activeElement)
      .toBe(wrapper.get('button').element)
  })

  it('stays open on invalid text and Enter', async () => {
    const wrapper = await mountOpen()

    await input(wrapper).setValue('bad')
    await press(wrapper, 'Enter')

    expect(wrapper.emitted('commit')).toBeUndefined()
    expect(wrapper.emitted('invalid')?.at(-1))
      .toEqual(['Not an amount.'])
    expect(input(wrapper).attributes('aria-invalid'))
      .toBe('true')
  })

  it('reverts invalid text on clicking away', async () => {
    const wrapper = await mountOpen()

    await input(wrapper).setValue('bad')
    await input(wrapper).trigger('blur')

    expect(wrapper.emitted('commit')).toBeUndefined()
    expect(wrapper.emitted('invalid')?.at(-1))
      .toEqual(['Not an amount.'])
    expect(input(wrapper).exists()).toBe(false)
  })

  it('clears the reason on typing', async () => {
    const wrapper = await mountOpen()

    await input(wrapper).setValue('bad')
    await press(wrapper, 'Enter')
    await input(wrapper).setValue('45')

    expect(wrapper.emitted('invalid')?.at(-1))
      .toEqual([null])
    expect(input(wrapper).attributes('aria-invalid'))
      .toBe('false')
  })
})
