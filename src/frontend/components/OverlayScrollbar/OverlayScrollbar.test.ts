import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import {
  HIDE_AFTER,
  REPEAT_AFTER,
  REPEAT_EVERY
} from '@/composables/use-overlay-scrollbar'
import OverlayScrollbar from './OverlayScrollbar.vue'

// happy-dom has no layout: the scroller is 100 by 200
// at the origin, over content 100 by `scrollHeight`.
// Its 196px track has a 49px thumb with 147px free,
// for 600px of scrolling.
const fakeScroller = (scrollHeight = 800): HTMLElement => {
  const el = document.createElement('div')
  const layout = {
    clientWidth: 100,
    clientHeight: 200,
    scrollWidth: 100,
    scrollHeight
  }
  for (const [key, value] of Object.entries(layout))
    Object.defineProperty(el, key, { value })
  for (const key of ['scrollTop', 'scrollLeft']) {
    Object.defineProperty(el, key,
      { value: 0, writable: true })
  }
  el.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    right: 100,
    bottom: 200
  }) as DOMRect
  document.body.append(el)
  return el
}

let wrapper: VueWrapper | undefined

const mountBar = async (
  el: HTMLElement
): Promise<VueWrapper> => {
  wrapper = mount(OverlayScrollbar, {
    props: { target: el },
    attachTo: document.body
  })
  await nextTick()
  return wrapper
}

const track = (): HTMLElement =>
  wrapper!.get<HTMLElement>('.track.-y').element

const thumb = (): HTMLElement =>
  wrapper!.get<HTMLElement>('.thumb').element

const scroll = async (
  el: HTMLElement,
  top: number
): Promise<void> => {
  el.scrollTop = top
  el.dispatchEvent(new Event('scroll'))
  await nextTick()
}

const press = (
  on: HTMLElement,
  clientY: number,
  button = 0
): void => {
  on.dispatchEvent(new PointerEvent('pointerdown',
    { clientY, button, bubbles: true, cancelable: true }))
}

const on = (type: string, clientY = 0): void => {
  window.dispatchEvent(new PointerEvent(type, { clientY }))
}

const advance = async (ms: number): Promise<void> => {
  vi.advanceTimersByTime(ms)
  await nextTick()
}

describe('OverlayScrollbar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.replaceChildren()
    vi.useRealTimers()
  })

  it('draws no bar when nothing overflows', async () => {
    await mountBar(fakeScroller(200))

    expect(wrapper!.find('.track').exists()).toBe(false)
  })

  it('draws the thumb along the right edge', async () => {
    const el = fakeScroller()
    await mountBar(el)
    await scroll(el, 300)

    expect(track().style.top).toBe('2px')
    expect(track().style.bottom).toBe('2px')
    expect(track().style.right).toBe('2px')
    expect(track().style.width).toBe('6px')
    expect(thumb().style.height).toBe('49px')
    expect(thumb().style.transform)
      .toBe('translateY(73.5px)')
  })

  it('takes the pointer only while visible', async () => {
    const el = fakeScroller()
    await mountBar(el)
    expect(track().style.opacity).toBe('0')
    expect(track().style.pointerEvents).toBe('none')

    await scroll(el, 10)
    expect(track().style.opacity).toBe('1')
    expect(track().style.pointerEvents).toBe('auto')

    await advance(HIDE_AFTER)
    expect(track().style.pointerEvents).toBe('none')
  })

  it('stays visible while hovered', async () => {
    const el = fakeScroller()
    await mountBar(el)
    await scroll(el, 10)
    track().dispatchEvent(new PointerEvent('pointerenter'))
    await advance(HIDE_AFTER * 2)

    expect(track().style.opacity).toBe('1')
    expect(track().classList).toContain('-active')

    track().dispatchEvent(new PointerEvent('pointerleave'))
    await advance(HIDE_AFTER)
    expect(track().style.opacity).toBe('0')
  })

  it('scrolls as the thumb is dragged', async () => {
    const el = fakeScroller()
    await mountBar(el)
    await scroll(el, 10)

    press(thumb(), 50)
    on('pointermove', 99)
    await advance(HIDE_AFTER * 2)
    // 49px of 147 free is a third of 600.
    expect(el.scrollTop).toBe(210)
    expect(track().style.opacity).toBe('1')

    on('pointerup')
    on('pointermove', 150)
    expect(el.scrollTop).toBe(210)
  })

  it('pages towards a press on the track, while held',
    async () => {
      const el = fakeScroller()
      await mountBar(el)
      await scroll(el, 1)

      press(track(), 140)
      expect(el.scrollTop).toBe(201)
      await advance(REPEAT_AFTER)
      expect(el.scrollTop).toBe(401)
      // The thumb has reached the pointer.
      await advance(REPEAT_EVERY * 3)
      expect(el.scrollTop).toBe(401)
    })

  it('stops paging when released', async () => {
    const el = fakeScroller()
    await mountBar(el)
    await scroll(el, 1)

    press(track(), 190)
    on('pointerup')
    await advance(REPEAT_AFTER * 2)

    expect(el.scrollTop).toBe(201)
  })

  it('ignores presses but the main button', async () => {
    const el = fakeScroller()
    await mountBar(el)
    await scroll(el, 1)

    press(track(), 190, 2)

    expect(el.scrollTop).toBe(1)
  })

  it('scrolls the area for a wheel over it', async () => {
    const el = fakeScroller()
    el.scrollBy = vi.fn()
    await mountBar(el)
    await scroll(el, 10)

    const wheel = new WheelEvent('wheel',
      { deltaY: 3, deltaMode: 1, cancelable: true })
    track().dispatchEvent(wheel)

    expect(el.scrollBy).toHaveBeenCalledWith(0, 48)
    expect(wheel.defaultPrevented).toBe(true)
  })

  it('fades unless motion is reduced', async () => {
    const el = fakeScroller()
    await mountBar(el)
    expect(track().style.transitionDuration).toBe('')
    wrapper!.unmount()

    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })))
    await mountBar(el)

    expect(track().style.transitionDuration).toBe('0s')
  })
})
