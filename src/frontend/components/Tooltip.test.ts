import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import {
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import Tooltip from './Tooltip.vue'

let tooltip: VueWrapper | undefined

const mountTooltip = (delay?: number): VueWrapper =>
  tooltip = mount(Tooltip, {
    attachTo: document.body,
    props: { text: 'Sleep', delay },
    slots: { default: '<a href="#">x</a>' }
  })

const bubble = (
  wrapper: VueWrapper
): DOMWrapper<Element> =>
  wrapper.find('.bubble')

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    tooltip?.unmount()
    tooltip = undefined
    vi.useRealTimers()
  })

  it.each(['mouseenter', 'focusin'])(
    'shows on %s after the delay',
    async event => {
      const wrapper = mountTooltip()

      await wrapper.trigger(event)
      await vi.advanceTimersByTimeAsync(399)
      expect(bubble(wrapper).exists()).toBe(false)

      await vi.advanceTimersByTimeAsync(1)
      expect(bubble(wrapper).text()).toBe('Sleep')
    }
  )

  it('takes a custom delay', async () => {
    const wrapper = mountTooltip(50)

    await wrapper.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(50)

    expect(bubble(wrapper).exists()).toBe(true)
  })

  it.each([
    ['mouseenter', 'mouseleave'],
    ['focusin', 'focusout']
  ])('hides on %s then %s', async (enter, leave) => {
    const wrapper = mountTooltip()
    await wrapper.trigger(enter)
    await vi.advanceTimersByTimeAsync(400)

    await wrapper.trigger(leave)

    expect(bubble(wrapper).exists()).toBe(false)
  })

  it('never shows if left before the delay', async () => {
    const wrapper = mountTooltip()

    await wrapper.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(200)
    await wrapper.trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(400)

    expect(bubble(wrapper).exists()).toBe(false)
  })

  it('hides on Escape', async () => {
    const wrapper = mountTooltip()
    await wrapper.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(400)

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape' })
    )
    await wrapper.vm.$nextTick()

    expect(bubble(wrapper).exists()).toBe(false)
  })

  it('is hidden from screen readers', async () => {
    const wrapper = mountTooltip()
    await wrapper.trigger('focusin')
    await vi.advanceTimersByTimeAsync(400)

    expect(bubble(wrapper).attributes('aria-hidden'))
      .toBe('true')
  })

  describe('truncatedOnly', () => {
    /** A trigger whose text is `cut` off or not. */
    const mountTruncated = (cut: boolean): VueWrapper => {
      const wrapper = tooltip = mount(Tooltip, {
        attachTo: document.body,
        props: {
          text: 'Groceries',
          placement: 'above',
          truncatedOnly: true
        },
        slots: { default: '<span>Groc…</span>' }
      })
      const trigger = wrapper.get('span > span').element
      Object.defineProperties(trigger, {
        scrollWidth: { value: cut ? 80 : 40 },
        clientWidth: { value: 40 }
      })
      return wrapper
    }

    it('shows above when the text is cut off', async () => {
      const wrapper = mountTruncated(true)

      await wrapper.trigger('focusin')
      await vi.advanceTimersByTimeAsync(400)

      expect(bubble(wrapper).classes()).toContain('-above')
      expect(bubble(wrapper).text()).toBe('Groceries')
    })

    it('stays hidden when the text fits', async () => {
      const wrapper = mountTruncated(false)

      await wrapper.trigger('mouseenter')
      await vi.advanceTimersByTimeAsync(400)

      expect(bubble(wrapper).exists()).toBe(false)
    })
  })
})
