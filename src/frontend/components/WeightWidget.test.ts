import { afterEach, describe, expect, it } from 'vitest'
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  fakeBulletin,
  stubBulletin
} from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import WeightWidget from './WeightWidget.vue'

const mountWidget = (): VueWrapper => {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(WeightWidget, {
    attachTo: document.body,
    global: { plugins: [pinia] }
  })
}

describe('WeightWidget', () => {
  useFixedToday()
  enableAutoUnmount(afterEach)

  it('loads the window and a year past each edge', () => {
    const { weight } = stubBulletin()
    const widget = mountWidget()

    expect(widget.get('.title').text()).toBe('Weight')
    expect(weight.list).toHaveBeenCalledExactlyOnceWith({
      from: '2025-06-01',
      to: '2028-04-30'
    })
  })

  it('reloads only when the month changes', async () => {
    const { weight } = stubBulletin()
    mountWidget()
    const store = useSelectedDateStore()

    store.setDay(new Date(2026, 10, 2))
    await flushPromises()
    expect(weight.list).toHaveBeenCalledTimes(1)

    store.setDay(new Date(2026, 9, 31))
    await flushPromises()
    expect(weight.list).toHaveBeenCalledTimes(2)
    expect(weight.list).toHaveBeenLastCalledWith({
      from: '2025-05-01',
      to: '2028-03-31'
    })
  })

  it('draws the loaded Entries', async () => {
    stubBulletin({
      weight: {
        ...fakeBulletin().weight,
        list: async () => ({
          ok: true,
          value: [{ date: '2026-11-02', grams: 63_400 }]
        })
      }
    })
    const widget = mountWidget()
    await flushPromises()

    // A lone Entry has no curve, so it's drawn as a dot.
    expect(widget.find('.notice').exists()).toBe(false)
    expect(widget.find('.dot').exists()).toBe(true)
  })

  it('says when loading fails', async () => {
    stubBulletin({
      weight: {
        ...fakeBulletin().weight,
        list: async () => ({
          ok: false,
          error: { code: 'internal' }
        })
      }
    })
    const widget = mountWidget()
    await flushPromises()

    expect(widget.get('[role="alert"]').text())
      .toBe('Couldn\'t load your weight')
  })

  it('opens the form on "+" and closes it', async () => {
    const { weight } = stubBulletin()
    const widget = mountWidget()
    const add = 'button[aria-label="Add weight"]'

    await widget.get(add).trigger('click')
    expect(widget.get('.title').text())
      .toBe('Add new entry')

    await widget.get('button[aria-label="Cancel"]')
      .trigger('click')
    await flushPromises()

    expect(widget.get('.title').text()).toBe('Weight')
    expect(document.activeElement)
      .toBe(widget.get(add).element)
    expect(weight.create).not.toHaveBeenCalled()
  })

  it('reloads the chart after a save', async () => {
    const { weight } = stubBulletin()
    const widget = mountWidget()

    await widget.get('button[aria-label="Add weight"]')
      .trigger('click')
    await widget.get('input').setValue('63,4')
    await widget.get('button[aria-label="Save weight"]')
      .trigger('click')
    await flushPromises()

    expect(weight.create).toHaveBeenCalledExactlyOnceWith({
      date: '2026-11-09',
      grams: 63_400
    })
    expect(widget.get('.title').text()).toBe('Weight')
    // The window's load, the form's day, and the reload.
    expect(weight.list).toHaveBeenCalledTimes(3)
  })
})
