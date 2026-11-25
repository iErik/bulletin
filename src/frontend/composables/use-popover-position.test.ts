import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  enableAutoUnmount,
  flushPromises,
  mount
} from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { usePopoverPosition } from './use-popover-position'

const rect = (
  overrides: Partial<DOMRect>
): DOMRect => ({
  left: 0, right: 0, top: 0, bottom: 0,
  width: 0, height: 0, x: 0, y: 0,
  toJSON: () => ({}),
  ...overrides
})

describe('usePopoverPosition', () => {
  enableAutoUnmount(afterEach)
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('places beside anchor and updates on resize and deps',
    async () => {
      let vw = 900
      vi.spyOn(window, 'innerWidth', 'get')
        .mockImplementation(() => vw)
      vi.spyOn(window, 'innerHeight', 'get')
        .mockReturnValue(600)

      const anchor = document.createElement('button')
      vi.spyOn(anchor, 'getBoundingClientRect')
        .mockReturnValue(rect({
          left: 420, right: 580, top: 80, width: 160, height: 34
        }))
      vi.spyOn(Element.prototype, 'getBoundingClientRect')
        .mockReturnValue(rect({ width: 316, height: 260 }))

      const tick = ref(0)
      const Host = defineComponent({
        setup() {
          const panel = ref<HTMLElement | null>(null)
          const { position } = usePopoverPosition(
            panel, () => anchor, [tick]
          )
          return { panel, position }
        },
        template: '<div ref="panel" :style="{ left: `${position.left}px`, top: `${position.top}px` }" />'
      })

      const wrapper = mount(Host, { attachTo: document.body })
      await nextTick()
      // 580 + 8 = 588? 588 + 316 = 904 > 892, flips left: 96.
      expect((wrapper.element as HTMLElement).style.left)
        .toBe('96px')

      vw = 1200
      window.dispatchEvent(new Event('resize'))
      await nextTick()
      // Fits right: 580 + 8 = 588.
      expect((wrapper.element as HTMLElement).style.left)
        .toBe('588px')

      vw = 600
      tick.value++
      await flushPromises()
      expect((wrapper.element as HTMLElement).style.left)
        .toBe('96px')

      // Capture scroll repositions; unmount removes listeners.
      vw = 1200
      document.dispatchEvent(new Event('scroll'))
      await nextTick()
      expect((wrapper.element as HTMLElement).style.left)
        .toBe('588px')

      const off = vi.spyOn(window, 'removeEventListener')
      wrapper.unmount()
      expect(off).toHaveBeenCalledWith(
        'resize', expect.any(Function)
      )
      expect(off).toHaveBeenCalledWith(
        'scroll', expect.any(Function), true
      )
    })

  it('positions a panel mounted conditionally via v-if',
    async () => {
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(600)
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600)
      const anchor = document.createElement('button')
      vi.spyOn(anchor, 'getBoundingClientRect')
        .mockReturnValue(rect({ left: 420, right: 580, top: 80 }))
      vi.spyOn(Element.prototype, 'getBoundingClientRect')
        .mockReturnValue(rect({ width: 316, height: 260 }))

      const open = ref(false)
      const Host = defineComponent({
        setup() {
          const panel = ref<HTMLElement | null>(null)
          const { position } = usePopoverPosition(
            panel, () => anchor
          )
          return { open, panel, position }
        },
        template: '<div v-if="open" ref="panel" :style="{ left: `${position.left}px` }" />'
      })

      const wrapper = mount(Host, { attachTo: document.body })
      open.value = true
      await flushPromises()
      expect((wrapper.element as HTMLElement).style.left)
        .toBe('96px')
    })
})
