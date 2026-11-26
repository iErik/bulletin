import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Tooltip from './Tooltip.vue'

type TooltipProps = InstanceType<typeof Tooltip>['$props']

let tooltip: VueWrapper | undefined

const mountTooltip = (
  props: Partial<TooltipProps> = {}
): VueWrapper =>
  tooltip = mount(Tooltip, {
    attachTo: document.body,
    props: { text: 'Sleep', ...props },
    slots: { default: '<a href="#">x</a>' }
  })

const bubble = (): HTMLElement | null =>
  document.body.querySelector('.app-tooltip-bubble')

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
      expect(bubble()).toBeNull()

      await vi.advanceTimersByTimeAsync(1)
      expect(bubble()?.textContent?.trim()).toBe('Sleep')
    }
  )

  it('takes a custom delay', async () => {
    const wrapper = mountTooltip({ delay: 50 })

    await wrapper.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(50)

    expect(bubble()).not.toBeNull()
  })

  it.each([
    ['mouseenter', 'mouseleave'],
    ['focusin', 'focusout']
  ])('hides on %s then %s', async (enter, leave) => {
    const wrapper = mountTooltip()
    await wrapper.trigger(enter)
    await vi.advanceTimersByTimeAsync(400)
    expect(bubble()).not.toBeNull()

    await wrapper.trigger(leave)

    expect(bubble()).toBeNull()
  })

  it('never shows if left before the delay', async () => {
    const wrapper = mountTooltip()

    await wrapper.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(200)
    await wrapper.trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(400)

    expect(bubble()).toBeNull()
  })

  it('hides on Escape', async () => {
    const wrapper = mountTooltip()
    await wrapper.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(400)
    expect(bubble()).not.toBeNull()

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape' })
    )
    await wrapper.vm.$nextTick()

    expect(bubble()).toBeNull()
  })

  it('is hidden from screen readers', async () => {
    const wrapper = mountTooltip()
    await wrapper.trigger('focusin')
    await vi.advanceTimersByTimeAsync(400)

    expect(bubble()?.getAttribute('aria-hidden'))
      .toBe('true')
  })

  it('defaults placement to top', async () => {
    const wrapper = mountTooltip()
    await wrapper.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(400)

    expect(bubble()?.classList.contains('-top')).toBe(true)
  })

  it.each(['top', 'bottom', 'left', 'right'] as const)(
    'applies the -%s placement class',
    async placement => {
      const wrapper = mountTooltip({ placement })
      await wrapper.trigger('mouseenter')
      await vi.advanceTimersByTimeAsync(400)

      expect(bubble()?.classList.contains(`-${placement}`))
        .toBe(true)
    }
  )

  it('stays open immediately when forceOpen is true',
    async () => {
      const wrapper = mountTooltip({ forceOpen: true })

      expect(bubble()?.textContent?.trim()).toBe('Sleep')

      await wrapper.trigger('mouseleave')
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape' })
      )
      await wrapper.vm.$nextTick()

      expect(bubble()).not.toBeNull()
    }
  )

  it('applies an explicit position to the bubble', () => {
    mountTooltip({
      forceOpen: true,
      position: { top: '12px', left: '24px' }
    })

    expect(bubble()?.style.top).toBe('12px')
    expect(bubble()?.style.left).toBe('24px')
  })

  it('removes the teleported bubble on unmount',
    async () => {
      const wrapper = mountTooltip()
      await wrapper.trigger('mouseenter')
      await vi.advanceTimersByTimeAsync(400)
      expect(bubble()).not.toBeNull()

      wrapper.unmount()
      tooltip = undefined

      expect(bubble()).toBeNull()
    }
  )

  describe('truncatedOnly', () => {
    /** A trigger whose text is `cut` off or not. */
    const mountTruncated = (cut: boolean): VueWrapper => {
      const wrapper = tooltip = mount(Tooltip, {
        attachTo: document.body,
        props: {
          text: 'Groceries',
          placement: 'top',
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

    it('shows at top when the text is cut off',
      async () => {
        const wrapper = mountTruncated(true)

        await wrapper.trigger('focusin')
        await vi.advanceTimersByTimeAsync(400)

        expect(bubble()?.classList.contains('-top'))
          .toBe(true)
        expect(bubble()?.textContent?.trim())
          .toBe('Groceries')
      }
    )

    it('stays hidden when the text fits', async () => {
      const wrapper = mountTruncated(false)

      await wrapper.trigger('mouseenter')
      await vi.advanceTimersByTimeAsync(400)

      expect(bubble()).toBeNull()
    })
  })
})
