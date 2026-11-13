import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper }
  from '@vue/test-utils'
import { useFixedToday } from '@/testing/clock'
import DateCell from './DateCell.vue'

let cell: VueWrapper | undefined

/** Mounts it on Nov 3 and opens the popover. */
const mountOpen = async (): Promise<VueWrapper> => {
  cell = mount(DateCell, {
    attachTo: document.body,
    props: { date: '2026-11-03', max: new Date(2026, 10, 9) }
  })
  await cell.get('button').trigger('click')
  await flushPromises()
  return cell
}

/** Chooses `day` of the month in the popover. */
const choose = async (
  wrapper: VueWrapper,
  day: number
): Promise<void> => {
  await wrapper.get('select[aria-label="Day"]')
    .setValue(String(day))
}

const press = async (
  wrapper: VueWrapper,
  key: string
): Promise<void> => {
  await wrapper.get('select[aria-label="Day"]')
    .trigger('keydown', { key })
  await flushPromises()
}

describe('DateCell', () => {
  useFixedToday()

  afterEach(() => {
    cell?.unmount()
    cell = undefined
  })

  it('shows the short date', () => {
    cell = mount(DateCell, {
      props: { date: '2026-11-03', max: new Date(2026, 10, 9) }
    })

    expect(cell.get('time').text()).toBe('Nov 3')
    expect(cell.get('time').attributes('datetime'))
      .toBe('2026-11-03')
  })

  it('opens on its day, focusing the dropdowns', async () => {
    const wrapper = await mountOpen()

    const day = wrapper.get<HTMLSelectElement>(
      'select[aria-label="Day"]'
    )
    expect(day.element.value).toBe('3')
    expect(document.activeElement).toBe(day.element)
    expect(wrapper.get('button').attributes('aria-expanded'))
      .toBe('true')
  })

  it('offers no day after `max`', async () => {
    const wrapper = await mountOpen()

    expect(wrapper.findAll('select[aria-label="Day"] option')
      .at(-1)?.text()).toBe('09')
  })

  it('commits on Enter, refocusing the date', async () => {
    const wrapper = await mountOpen()

    await choose(wrapper, 5)
    await press(wrapper, 'Enter')

    expect(wrapper.emitted('commit'))
      .toEqual([['2026-11-05']])
    expect(wrapper.find('[role="dialog"]').exists())
      .toBe(false)
    expect(document.activeElement)
      .toBe(wrapper.get('button').element)
  })

  it('commits on a click outside', async () => {
    const wrapper = await mountOpen()

    await choose(wrapper, 5)
    await wrapper.get('.backdrop').trigger('pointerdown')

    expect(wrapper.emitted('commit'))
      .toEqual([['2026-11-05']])
  })

  it('commits when focus moves away', async () => {
    const wrapper = await mountOpen()
    const elsewhere = document.createElement('button')
    document.body.append(elsewhere)

    await choose(wrapper, 5)
    elsewhere.focus()
    await flushPromises()

    expect(wrapper.emitted('commit'))
      .toEqual([['2026-11-05']])
    elsewhere.remove()
  })

  it('cancels on Escape', async () => {
    const wrapper = await mountOpen()

    await choose(wrapper, 5)
    await press(wrapper, 'Escape')

    expect(wrapper.emitted('commit')).toBeUndefined()
    expect(document.activeElement)
      .toBe(wrapper.get('button').element)
  })

  it('doesn’t commit the same day', async () => {
    const wrapper = await mountOpen()

    await press(wrapper, 'Enter')

    expect(wrapper.emitted('commit')).toBeUndefined()
  })
})
