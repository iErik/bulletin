import { afterEach, describe, expect, it } from 'vitest'
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import WeightWidget from './WeightWidget.vue'

const mountWidget = (): VueWrapper => {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(WeightWidget, {
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
        ...stubBulletin().weight,
        list: async () => ({
          ok: true,
          value: [{ date: '2026-11-02', grams: 63_400 }]
        })
      }
    })
    const widget = mountWidget()
    await flushPromises()

    expect(widget.find('.notice').exists()).toBe(false)
    expect(widget.get('.line').attributes('d'))
      .not.toBe('')
  })

  it('says when loading fails', async () => {
    stubBulletin({
      weight: {
        ...stubBulletin().weight,
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
})
