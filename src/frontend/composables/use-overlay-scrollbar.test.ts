import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import {
  HIDE_AFTER,
  MIN_THUMB,
  REPEAT_AFTER,
  REPEAT_EVERY,
  useOverlayScrollbar,
  type OverlayScrollbar
} from './use-overlay-scrollbar'

// happy-dom has no layout: the element is 100 by 200
// at the origin, scrolling over `layout`'s content.
interface Layout {
  clientWidth: number
  clientHeight: number
  scrollWidth: number
  scrollHeight: number
}

const fakeScroller = (): {
  el: HTMLElement
  layout: Layout
} => {
  const layout: Layout = {
    clientWidth: 100,
    clientHeight: 200,
    scrollWidth: 100,
    scrollHeight: 800
  }
  const el = document.createElement('div')
  for (const key of Object.keys(layout) as
    (keyof Layout)[])
    Object.defineProperty(el, key, { get: () => layout[key] })
  for (const key of ['scrollTop', 'scrollLeft']) {
    Object.defineProperty(el, key,
      { value: 0, writable: true })
  }
  el.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    right: layout.clientWidth,
    bottom: layout.clientHeight
  }) as DOMRect
  document.body.append(el)
  return { el, layout }
}

let wrapper: VueWrapper | undefined

const use = (el: HTMLElement): OverlayScrollbar => {
  let api!: OverlayScrollbar
  wrapper = mount(defineComponent({
    setup() {
      api = useOverlayScrollbar(() => el)
      return () => null
    }
  }))
  return api
}

const scroll = (el: HTMLElement, top: number): void => {
  el.scrollTop = top
  el.dispatchEvent(new Event('scroll'))
}

const point = (
  el: HTMLElement,
  clientX: number,
  clientY: number
): void => {
  el.dispatchEvent(new PointerEvent('pointermove',
    { clientX, clientY }))
}

const at = (clientY: number): PointerEvent =>
  ({ clientY, clientX: 0 }) as PointerEvent

describe('useOverlayScrollbar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.replaceChildren()
    vi.useRealTimers()
  })

  it('shows a bar only on an axis that overflows', () => {
    const { el } = fakeScroller()
    const { bars } = use(el)

    expect(bars.y.overflows).toBe(true)
    expect(bars.x.overflows).toBe(false)
  })

  it('sizes and places the thumb along its track', () => {
    const { el } = fakeScroller()
    const { bars } = use(el)
    // A 196px track, a quarter of the content shown.
    expect(bars.y.size).toBe(49)

    scroll(el, 300)

    expect(bars.y.offset).toBe(147 / 2)
  })

  it('keeps the thumb at least MIN_THUMB long', () => {
    const { el, layout } = fakeScroller()
    layout.scrollHeight = 100_000
    const { bars } = use(el)

    expect(bars.y.size).toBe(MIN_THUMB)
  })

  it('leaves the corner free when both overflow', () => {
    const { el, layout } = fakeScroller()
    layout.scrollWidth = 400
    const { bars, both } = use(el)

    expect(both.value).toBe(true)
    // Each track less the insets and the corner, and a
    // quarter of it, but no less than MIN_THUMB.
    expect(bars.y.size).toBe(186 / 4)
    expect(bars.x.size).toBe(MIN_THUMB)
  })

  it('shows while scrolling, hiding after a pause', () => {
    const { el } = fakeScroller()
    const { bars } = use(el)
    expect(bars.y.visible).toBe(false)

    scroll(el, 10)
    vi.advanceTimersByTime(HIDE_AFTER - 1)
    expect(bars.y.visible).toBe(true)
    scroll(el, 20)
    vi.advanceTimersByTime(HIDE_AFTER - 1)
    expect(bars.y.visible).toBe(true)

    vi.advanceTimersByTime(1)
    expect(bars.y.visible).toBe(false)
  })

  it('shows only the axis that scrolled', () => {
    const { el, layout } = fakeScroller()
    layout.scrollWidth = 400
    const { bars } = use(el)

    scroll(el, 10)

    expect(bars.y.visible).toBe(true)
    expect(bars.x.visible).toBe(false)
  })

  it('shows while the pointer is near an edge', () => {
    const { el, layout } = fakeScroller()
    layout.scrollWidth = 400
    const { bars } = use(el)

    point(el, 87, 10)
    expect(bars.y.visible).toBe(false)
    point(el, 88, 10)
    vi.advanceTimersByTime(HIDE_AFTER * 2)
    expect(bars.y.visible).toBe(true)
    expect(bars.x.visible).toBe(false)
    point(el, 10, 188)
    expect(bars.x.visible).toBe(true)

    el.dispatchEvent(new PointerEvent('pointerleave'))
    vi.advanceTimersByTime(HIDE_AFTER - 1)
    expect(bars.y.visible).toBe(true)
    vi.advanceTimersByTime(1)
    expect(bars.x.visible).toBe(false)
    expect(bars.y.visible).toBe(false)
  })

  it('stays while hovered, and shows it', () => {
    const { el } = fakeScroller()
    const { bars, hover } = use(el)
    scroll(el, 10)

    hover('y', true)
    vi.advanceTimersByTime(HIDE_AFTER * 2)
    expect(bars.y).toMatchObject(
      { visible: true, active: true })

    hover('y', false)
    expect(bars.y.active).toBe(false)
    vi.advanceTimersByTime(HIDE_AFTER)
    expect(bars.y.visible).toBe(false)
  })

  it('scrolls as the thumb is dragged', () => {
    const { el } = fakeScroller()
    const { bars, startDrag, moveDrag, release } = use(el)

    startDrag('y', at(20))
    moveDrag(at(20 + 49))
    vi.advanceTimersByTime(HIDE_AFTER * 2)

    // 147px of free track for 600px of scrolling.
    expect(el.scrollTop).toBe(200)
    expect(bars.y).toMatchObject(
      { visible: true, active: true, offset: 49 })

    release()
    moveDrag(at(140))
    expect(el.scrollTop).toBe(200)
  })

  it('pages towards a press on the track until the '
    + 'thumb reaches it', () => {
    const { el } = fakeScroller()
    const { startPaging, release } = use(el)

    startPaging('y', at(150))
    expect(el.scrollTop).toBe(200)
    vi.advanceTimersByTime(REPEAT_AFTER)
    expect(el.scrollTop).toBe(400)
    vi.advanceTimersByTime(REPEAT_EVERY)
    // The thumb is now under the pointer.
    expect(el.scrollTop).toBe(600)
    vi.advanceTimersByTime(REPEAT_EVERY * 5)
    expect(el.scrollTop).toBe(600)

    release()
    startPaging('y', at(10))
    expect(el.scrollTop).toBe(400)
    release()
    vi.advanceTimersByTime(REPEAT_AFTER)
    expect(el.scrollTop).toBe(400)
  })

  it('measures again when the content changes', async () => {
    const { el, layout } = fakeScroller()
    layout.scrollHeight = 200
    const { bars } = use(el)
    expect(bars.y.overflows).toBe(false)

    layout.scrollHeight = 400
    el.append(document.createElement('p'))
    await vi.waitFor(() => {
      expect(bars.y.overflows).toBe(true)
    })
  })

  it('stops listening once unmounted', async () => {
    const { el } = fakeScroller()
    const { bars } = use(el)
    wrapper!.unmount()
    wrapper = undefined
    await nextTick()

    scroll(el, 10)

    expect(bars.y.visible).toBe(false)
  })
})
