import { afterEach, describe, expect, it } from 'vitest'
import {
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { today, useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import DateHeader from './DateHeader.vue'

let header: VueWrapper | undefined

interface Mounted {
  header: VueWrapper
  store: ReturnType<typeof useSelectedDateStore>
}

const mountHeader = (): Mounted => {
  const pinia = createPinia()
  setActivePinia(pinia)
  header = mount(DateHeader, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
  return { header, store: useSelectedDateStore() }
}

const press = async (
  key: string,
  init: KeyboardEventInit = {},
  target: EventTarget = window
): Promise<void> => {
  target.dispatchEvent(new KeyboardEvent(
    'keydown',
    { key, bubbles: true, ...init }
  ))
  await header?.vm.$nextTick()
}

const button = (
  name: string
): DOMWrapper<HTMLButtonElement> =>
  header!.findAll('button').find(b =>
    (b.attributes('aria-label') ?? b.text()) === name
  )!

// Months are 0-based.
describe('DateHeader', () => {
  useFixedToday()

  afterEach(() => {
    header?.unmount()
    header = undefined
    document.body.innerHTML = ''
  })

  it('shows today at launch', () => {
    const { header } = mountHeader()

    expect(header.get('.date').text())
      .toBe('November 9th, 2026')
  })

  it('keeps every control clickable', () => {
    const { header } = mountHeader()

    for (const control of header.findAll('button'))
      expect(control.classes()).toContain('no-drag')
  })

  it('steps with ‹ and ›, not past today', async () => {
    const { store } = mountHeader()
    const isDisabled = (name: string): boolean =>
      button(name).attributes('disabled') !== undefined

    expect(isDisabled('Next day')).toBe(true)
    expect(isDisabled('Today')).toBe(true)

    await button('Previous day').trigger('click')
    await button('Previous day').trigger('click')
    expect(store.day).toEqual(new Date(2026, 10, 7))
    expect(isDisabled('Next day')).toBe(false)
    expect(isDisabled('Today')).toBe(false)

    await button('Next day').trigger('click')
    expect(store.day).toEqual(new Date(2026, 10, 8))
  })

  it('returns to today with Today', async () => {
    const { store } = mountHeader()
    store.setDay(new Date(2025, 3, 1))
    await header!.vm.$nextTick()

    await button('Today').trigger('click')

    expect(store.day).toEqual(today)
  })

  describe('popover', () => {
    const open = async (): Promise<Mounted> => {
      const result = mountHeader()
      await result.header.get('.date').trigger('click')
      return result
    }

    it('opens from the date', async () => {
      const { header } = await open()

      expect(header.get('.date').attributes(
        'aria-expanded'
      )).toBe('true')
      expect(header.find('.date-picker').exists())
        .toBe(true)
    })

    it('closes on Escape', async () => {
      const { header } = await open()

      await press('Escape')

      expect(header.find('.date-picker').exists())
        .toBe(false)
      expect(document.activeElement)
        .toBe(header.get('.date').element)
    })

    it('closes on an outside click', async () => {
      const { header } = await open()

      const backdrop = header.get('.backdrop')
      expect(backdrop.classes()).toContain('no-drag')

      await backdrop.trigger('pointerdown')
      expect(header.find('.date-picker').exists())
        .toBe(false)
    })
  })

  describe('shortcuts', () => {
    it('steps with ← and →, up to today', async () => {
      const { store } = mountHeader()

      await press('ArrowLeft')
      await press('ArrowLeft')
      await press('ArrowRight')
      expect(store.day).toEqual(new Date(2026, 10, 8))

      await press('ArrowRight')
      await press('ArrowRight')
      expect(store.day).toEqual(today)
    })

    it('goes to today with T', async () => {
      const { store } = mountHeader()
      store.setDay(new Date(2025, 3, 1))

      await press('t')

      expect(store.day).toEqual(today)
    })

    it.each([
      ['an input', '<input>'],
      ['a select', '<select></select>'],
      ['a textarea', '<textarea></textarea>'],
      ['an editable element',
        '<div contenteditable="true"></div>']
    ])(
      'does nothing while typing in %s',
      async (_, html) => {
        const { store } = mountHeader()
        const holder = document.createElement('div')
        holder.innerHTML = html
        document.body.append(holder)
        const field = holder.firstElementChild!

        await press('ArrowLeft', {}, field)
        await press('t', {}, field)

        expect(store.day).toEqual(today)
      }
    )

    it('ignores keys with a modifier', async () => {
      const { store } = mountHeader()

      await press('ArrowLeft', { metaKey: true })
      await press('ArrowLeft', { ctrlKey: true })
      await press('ArrowLeft', { altKey: true })

      expect(store.day).toEqual(today)
    })

    it('stops listening when unmounted', async () => {
      const { store } = mountHeader()
      header!.unmount()
      header = undefined

      await press('ArrowLeft')

      expect(store.day).toEqual(today)
    })
  })
})
