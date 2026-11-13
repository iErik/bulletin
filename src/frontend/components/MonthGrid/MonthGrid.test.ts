import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { setLocaleOverride } from '@/locale/format'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { today, useFixedToday } from '@/testing/clock'
import MonthGrid from './MonthGrid.vue'

let grid: VueWrapper | undefined

const mountGrid = (
  props: Record<string, unknown> = {}
): VueWrapper => {
  const pinia = createPinia()
  setActivePinia(pinia)
  return grid = mount(MonthGrid, {
    attachTo: document.body,
    props: {
      month: today,
      label: () => 'No mood',
      ...props
    },
    global: { plugins: [pinia] }
  })
}

/** Each grid slot: a day number, or 0 when empty. */
const slots = (wrapper: VueWrapper): number[] =>
  wrapper.findAll('.slot, .pill').map(slot =>
    slot.classes('pill')
      ? Number(slot.attributes('aria-label')
          ?.match(/\d+/)?.[0])
      : 0)

const pill = (
  wrapper: VueWrapper,
  day: number
): DOMWrapper<HTMLButtonElement> =>
  wrapper.findAll<HTMLButtonElement>('.pill')[day - 1]

const press = async (
  target: DOMWrapper<Element>,
  key: string
): Promise<void> => {
  await target.trigger('keydown', { key })
}

const focusedDay = (): number | undefined => {
  const label = document.activeElement
    ?.getAttribute('aria-label')
  return label
    ? Number(label.match(/\d+/)?.[0])
    : undefined
}

// Today is November 9th, 2026; November 1st is a
// Sunday. Months are 0-based.
describe('MonthGrid', () => {
  useFixedToday()

  afterEach(() => {
    grid?.unmount()
    grid = undefined
    document.body.innerHTML = ''
  })

  describe('layout', () => {
    it('starts weeks on Sunday in en-US', () => {
      const wrapper = mountGrid()

      expect(wrapper.findAll('.weekday').map(w => w.text()))
        .toEqual([
          'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'
        ])
      expect(slots(wrapper).slice(0, 7))
        .toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it('starts weeks on Monday in en-GB', async () => {
      setLocaleOverride('en-GB')
      const wrapper = mountGrid()

      expect(wrapper.get('.weekday').text()).toBe('MON')
      expect(slots(wrapper).slice(0, 7))
        .toEqual([0, 0, 0, 0, 0, 0, 1])
    })

    it('leaves trailing slots empty', () => {
      const all = slots(mountGrid())

      // 30 days from Sunday: 5 weeks.
      expect(all).toHaveLength(35)
      expect(all.slice(28))
        .toEqual([29, 30, 0, 0, 0, 0, 0])
    })

    it('tells the grid how many weeks it has', () => {
      setLocaleOverride('en-GB')
      const wrapper = mountGrid({
        // March 1st, 2026 is a Sunday: 6 weeks.
        month: new Date(2026, 2, 1)
      })

      expect(wrapper.attributes('style'))
        .toContain('--weeks: 6')
    })
  })

  describe('states', () => {
    it('dims and ignores days after today', async () => {
      const wrapper = mountGrid()

      await pill(wrapper, 10).trigger('click')

      expect(pill(wrapper, 9).classes())
        .not.toContain('-disabled')
      expect(pill(wrapper, 10).classes())
        .toContain('-disabled')
      expect(pill(wrapper, 10).attributes('aria-disabled'))
        .toBe('true')
      expect(wrapper.emitted('activate')).toBeUndefined()
    })

    it('dims and ignores the days it’s told to',
      async () => {
        const wrapper = mountGrid({
          disabled: (day: Date) => day.getDate() < 3
        })

        await pill(wrapper, 2).trigger('click')

        expect(pill(wrapper, 2).classes())
          .toContain('-disabled')
        expect(pill(wrapper, 2).attributes('aria-disabled'))
          .toBe('true')
        expect(pill(wrapper, 3).classes())
          .not.toContain('-disabled')
        expect(wrapper.emitted('activate')).toBeUndefined()
      })

    it('outlines only the Selected Date', async () => {
      const wrapper = mountGrid()
      const store = useSelectedDateStore()

      expect(wrapper.findAll('.pill.-selected'))
        .toHaveLength(1)
      expect(pill(wrapper, 9).classes())
        .toContain('-selected')

      store.setDay(new Date(2026, 10, 3))
      await wrapper.vm.$nextTick()

      expect(wrapper.findAll('.pill.-selected'))
        .toHaveLength(1)
      expect(pill(wrapper, 3).classes())
        .toContain('-selected')
    })

    it('paints the colours the Widget gives', () => {
      const colours = {
        base: 'red',
        glow: 'pink',
        shadow: 'white',
        tint: 'blue'
      }
      const wrapper = mountGrid({
        pill: (day: Date) =>
          day.getDate() === 4 ? colours : undefined
      })

      expect(pill(wrapper, 4).classes())
        .toContain('-filled')
      expect(pill(wrapper, 4).attributes('style'))
        .toBe('--pill-base: red; --pill-glow: pink; '
          + '--pill-shadow: white; --pill-tint: blue;')
      expect(pill(wrapper, 4).find('.glow').exists())
        .toBe(true)
      expect(pill(wrapper, 5).classes())
        .not.toContain('-filled')
    })

    it('draws an empty day as the base alone', () => {
      const wrapper = mountGrid()

      expect(pill(wrapper, 5).find('.base').exists())
        .toBe(true)
      expect(pill(wrapper, 5).find('.glow').exists())
        .toBe(false)
    })

    it('emits a clicked day', async () => {
      const wrapper = mountGrid()

      await pill(wrapper, 4).trigger('click')

      expect(wrapper.emitted('activate'))
        .toEqual([[new Date(2026, 10, 4)]])
    })
  })

  describe('tooltip', () => {
    const label = (day: Date): string =>
      day.getDate() === 4 ? 'Happy' : 'No mood'

    it('shows the day and label on hover', async () => {
      const wrapper = mountGrid({ label })

      await pill(wrapper, 4).trigger('pointerenter')

      expect(wrapper.get('.tooltip').text())
        .toBe('Nov 4 · Happy')

      await pill(wrapper, 4).trigger('pointerleave')

      expect(wrapper.find('.tooltip').exists()).toBe(false)
    })

    it('shows the day and label on focus', async () => {
      const wrapper = mountGrid({ label })

      await pill(wrapper, 9).trigger('focus')

      expect(wrapper.get('.tooltip').text())
        .toBe('Nov 9 · No mood')
      expect(pill(wrapper, 9).attributes('aria-label'))
        .toBe('Nov 9 · No mood')
    })
  })

  describe('keyboard', () => {
    it('is one Tab stop, on the Selected Date', () => {
      const wrapper = mountGrid()
      const stops = wrapper.findAll('[tabindex="0"]')

      expect(stops).toHaveLength(1)
      expect(stops[0].element).toBe(pill(wrapper, 9).element)
    })

    it('moves focus with the arrow keys', async () => {
      const wrapper = mountGrid()
      pill(wrapper, 9).element.focus()

      await press(pill(wrapper, 9), 'ArrowLeft')
      expect(focusedDay()).toBe(8)

      await press(pill(wrapper, 8), 'ArrowUp')
      expect(focusedDay()).toBe(1)

      await press(pill(wrapper, 1), 'ArrowDown')
      expect(focusedDay()).toBe(8)

      await press(pill(wrapper, 8), 'ArrowRight')
      expect(focusedDay()).toBe(9)
      expect(pill(wrapper, 9).attributes('tabindex'))
        .toBe('0')
    })

    it('skips days after today', async () => {
      const wrapper = mountGrid()
      pill(wrapper, 9).element.focus()

      await press(pill(wrapper, 9), 'ArrowRight')
      await press(pill(wrapper, 9), 'ArrowDown')

      expect(focusedDay()).toBe(9)
    })

    it('skips the days it’s told to', async () => {
      const wrapper = mountGrid({
        disabled: (day: Date) => day.getDate() < 8
      })
      pill(wrapper, 9).element.focus()

      await press(pill(wrapper, 9), 'ArrowUp')
      expect(focusedDay()).toBe(9)

      await press(pill(wrapper, 9), 'ArrowLeft')
      await press(pill(wrapper, 8), 'ArrowLeft')
      expect(focusedDay()).toBe(8)
    })

    it('keeps the Tab stop off disabled days', () => {
      const wrapper = mountGrid({
        month: new Date(2026, 9, 1),
        disabled: (day: Date) => day.getDate() < 5
      })

      expect(pill(wrapper, 5).attributes('tabindex'))
        .toBe('0')
    })

    it('stays inside the month', async () => {
      const wrapper = mountGrid()
      pill(wrapper, 1).element.focus()

      await press(pill(wrapper, 1), 'ArrowLeft')
      await press(pill(wrapper, 1), 'ArrowUp')

      expect(focusedDay()).toBe(1)
    })

    it.each(['Enter', ' '])(
      'activates the focused day with %j',
      async key => {
        const wrapper = mountGrid()

        await press(pill(wrapper, 6), key)

        expect(wrapper.emitted('activate'))
          .toEqual([[new Date(2026, 10, 6)]])
      }
    )

    it('keeps its keys from the window', async () => {
      const onKey = vi.fn()
      window.addEventListener('keydown', onKey)
      const wrapper = mountGrid()

      await press(pill(wrapper, 9), 'ArrowLeft')
      window.removeEventListener('keydown', onKey)

      expect(onKey).not.toHaveBeenCalled()
    })

    it('focuses a day on request', async () => {
      const wrapper = mountGrid()

      await (wrapper.vm as unknown as {
        focusDay: (day: Date) => Promise<void>
      }).focusDay(new Date(2026, 10, 5))

      expect(focusedDay()).toBe(5)
    })
  })
})
