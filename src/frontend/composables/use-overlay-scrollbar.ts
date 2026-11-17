/**
 * An overlay scrollbar's state for one scroll element,
 * which stays the native scroller with its own bar
 * hidden. Each axis that overflows shows a bar while
 * the element scrolls, and for HIDE_AFTER ms after;
 * while the pointer is within EDGE px of that axis's
 * edge; and while its bar is hovered or dragged.
 *
 * The thumb's size and offset follow the scroll range
 * along a track inset from the element's edges. When
 * both axes overflow, each track stops short of their
 * shared corner.
 */
import {
  onBeforeUnmount,
  reactive,
  ref,
  watch,
  type Ref
} from 'vue'

export type Axis = 'x' | 'y'
export const AXES: readonly Axis[] = ['y', 'x']

/** The thumb's thickness, in px. */
export const THICKNESS = 6
/** The track's gap to the element's edges, in px. */
export const INSET = 2
/** What a track leaves free for the other's corner. */
export const CORNER = THICKNESS + 2 * INSET
export const MIN_THUMB = 24
/** How near an edge the pointer reveals its bar. */
export const EDGE = 12
export const HIDE_AFTER = 800
/** Holding the track pages after this, then often. */
export const REPEAT_AFTER = 300
export const REPEAT_EVERY = 60

export interface Bar {
  overflows: boolean
  visible: boolean
  /** Hovered or dragged. */
  active: boolean
  /** The thumb's length along the track, in px. */
  size: number
  /** The thumb's distance from the track's start. */
  offset: number
}

type Pin = 'edge' | 'hover' | 'drag'

const KEYS = {
  y: {
    client: 'clientHeight',
    scroll: 'scrollHeight',
    position: 'scrollTop',
    start: 'top',
    coord: 'clientY'
  },
  x: {
    client: 'clientWidth',
    scroll: 'scrollWidth',
    position: 'scrollLeft',
    start: 'left',
    coord: 'clientX'
  }
} as const

const blank = (): Bar => ({
  overflows: false,
  visible: false,
  active: false,
  size: 0,
  offset: 0
})

export interface OverlayScrollbar {
  readonly bars: Readonly<Record<Axis, Bar>>
  /** Both axes overflow, so the corner is shared. */
  readonly both: Readonly<Ref<boolean>>
  /** The pointer is over `axis`'s track, or not. */
  hover(axis: Axis, on: boolean): void
  /** Starts dragging the thumb, from the pointer. */
  startDrag(axis: Axis, event: PointerEvent): void
  /** Scrolls as far as the thumb follows the pointer. */
  moveDrag(event: PointerEvent): void
  /**
   * Pages towards the pointer pressed on the track, and
   * again while held until the thumb reaches it.
   */
  startPaging(axis: Axis, event: PointerEvent): void
  /** Ends a drag or paging. */
  release(): void
}

export const useOverlayScrollbar = (
  target: () => HTMLElement | null | undefined
): OverlayScrollbar => {
  const bars = reactive({ x: blank(), y: blank() })
  const both = ref(false)
  const pins = { x: new Set<Pin>(), y: new Set<Pin>() }
  const recent = { x: false, y: false }
  const timers: Partial<Record<Axis, number>> = {}
  const last = { x: 0, y: 0 }

  const sync = (axis: Axis): void => {
    const bar = bars[axis]
    const held = pins[axis]
    bar.visible = bar.overflows
      && (recent[axis] || held.size > 0)
    bar.active = held.has('hover') || held.has('drag')
  }

  /** Shows the bar, hiding it HIDE_AFTER ms later. */
  const flash = (axis: Axis): void => {
    recent[axis] = true
    window.clearTimeout(timers[axis])
    timers[axis] = window.setTimeout(() => {
      recent[axis] = false
      sync(axis)
    }, HIDE_AFTER)
    sync(axis)
  }

  const pin = (axis: Axis, why: Pin, on: boolean): void => {
    const held = pins[axis]
    if (held.has(why) === on) return
    if (on) held.add(why)
    else held.delete(why)
    // Fades out after the pin, like after a scroll.
    if (on) sync(axis)
    else flash(axis)
  }

  const trackLength = (
    el: HTMLElement,
    axis: Axis
  ): number => el[KEYS[axis].client] - 2 * INSET
      - (both.value ? CORNER : 0)

  const measure = (): void => {
    const el = target()
    if (!el) return
    for (const axis of AXES) {
      const keys = KEYS[axis]
      bars[axis].overflows = el[keys.scroll] > el[keys.client]
    }
    both.value = bars.x.overflows && bars.y.overflows
    for (const axis of AXES) {
      const keys = KEYS[axis]
      const bar = bars[axis]
      const track = trackLength(el, axis)
      const range = el[keys.scroll] - el[keys.client]
      bar.size = range > 0
        ? Math.min(track, Math.max(MIN_THUMB,
            track * el[keys.client] / el[keys.scroll]))
        : 0
      bar.offset = range > 0
        ? (track - bar.size) * el[keys.position] / range
        : 0
      sync(axis)
    }
  }

  const onScroll = (): void => {
    const el = target()
    if (!el) return
    for (const axis of AXES) {
      const at = el[KEYS[axis].position]
      if (at !== last[axis]) flash(axis)
      last[axis] = at
    }
    measure()
  }

  // Near the right edge reveals the vertical bar, and
  // near the bottom the horizontal one.
  const onPointerMove = (event: PointerEvent): void => {
    const box = target()?.getBoundingClientRect()
    if (!box) return
    pin('y', 'edge', event.clientX >= box.right - EDGE)
    pin('x', 'edge', event.clientY >= box.bottom - EDGE)
  }

  const onPointerLeave = (): void => {
    pin('y', 'edge', false)
    pin('x', 'edge', false)
  }

  const scrollTo = (axis: Axis, at: number): void => {
    const el = target()
    if (!el) return
    el[KEYS[axis].position] = at
    onScroll()
  }

  let drag: {
    axis: Axis
    from: number
    coord: number
  } | null = null

  const startDrag = (
    axis: Axis,
    event: PointerEvent
  ): void => {
    const el = target()
    if (!el) return
    drag = {
      axis,
      from: el[KEYS[axis].position],
      coord: event[KEYS[axis].coord]
    }
    pin(axis, 'drag', true)
  }

  const moveDrag = (event: PointerEvent): void => {
    const el = target()
    if (!el || !drag) return
    const { axis, from, coord } = drag
    const keys = KEYS[axis]
    const bar = bars[axis]
    const free = trackLength(el, axis) - bar.size
    if (free <= 0) return
    const range = el[keys.scroll] - el[keys.client]
    scrollTo(axis,
      from + (event[keys.coord] - coord) * range / free)
  }

  let repeat: number | undefined
  let paging: { axis: Axis; coord: number } | null = null

  /** Pages one view towards the pointer, if it can. */
  const pageOnce = (): boolean => {
    const el = target()
    if (!el || !paging) return false
    const { axis, coord } = paging
    const keys = KEYS[axis]
    const bar = bars[axis]
    const start = el.getBoundingClientRect()[keys.start]
      + INSET + bar.offset
    const way = coord < start
      ? -1
      : coord > start + bar.size
        ? 1
        : 0
    if (way === 0) return false
    scrollTo(axis,
      el[keys.position] + way * el[keys.client])
    return true
  }

  const startPaging = (
    axis: Axis,
    event: PointerEvent
  ): void => {
    paging = { axis, coord: event[KEYS[axis].coord] }
    pin(axis, 'drag', true)
    if (!pageOnce()) return
    const again = (delay: number): void => {
      repeat = window.setTimeout(() => {
        if (pageOnce()) again(REPEAT_EVERY)
      }, delay)
    }
    again(REPEAT_AFTER)
  }

  const release = (): void => {
    const axis = drag?.axis ?? paging?.axis
    drag = null
    paging = null
    window.clearTimeout(repeat)
    if (axis) pin(axis, 'drag', false)
  }

  const hover = (axis: Axis, on: boolean): void =>
    pin(axis, 'hover', on)

  const resizes = new ResizeObserver(measure)
  const children = new MutationObserver(() => {
    const el = target()
    if (!el) return
    for (const child of el.children) resizes.observe(child)
    measure()
  })

  const detach = (el: HTMLElement): void => {
    el.removeEventListener('scroll', onScroll)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerleave', onPointerLeave)
    resizes.disconnect()
    children.disconnect()
  }

  watch(target, (el, old) => {
    if (old) detach(old)
    if (!el) return
    el.addEventListener('scroll', onScroll,
      { passive: true })
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerleave', onPointerLeave)
    resizes.observe(el)
    for (const child of el.children) resizes.observe(child)
    children.observe(el, { childList: true })
    last.x = el.scrollLeft
    last.y = el.scrollTop
    measure()
  }, { immediate: true, flush: 'post' })

  onBeforeUnmount(() => {
    const el = target()
    if (el) detach(el)
    release()
    for (const axis of AXES)
      window.clearTimeout(timers[axis])
  })

  return {
    bars,
    both,
    hover,
    startDrag,
    moveDrag,
    startPaging,
    release
  }
}
