/**
 * Keeps a teleported popover placed beside its anchor
 * element across mounts, resize, scroll and caller-
 * signalled layout changes.
 */
import {
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
  type WatchSource
} from 'vue'
import { placeBeside, type Point }
  from '@/tasks/popover-position'

export interface PopoverPlacement {
  readonly position: Readonly<Ref<Point>>
  readonly update: () => void
}

/** Tracks fixed coordinates for `panel` beside `anchor`. */
export const usePopoverPosition = (
  panel: Readonly<Ref<HTMLElement | null>>,
  anchor: () => HTMLElement | null,
  deps: readonly WatchSource[] = []
): PopoverPlacement => {
  const position = ref<Point>({ left: 8, top: 8 })

  const update = (): void => {
    const el = panel.value
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    position.value = placeBeside(
      anchor()?.getBoundingClientRect() ?? null,
      { width, height },
      { width: window.innerWidth, height: window.innerHeight }
    )
  }

  watch([anchor, ...deps], update, { flush: 'post' })

  onMounted(() => {
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, {
      capture: true, passive: true
    })
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', update)
    window.removeEventListener('scroll', update, true)
  })

  return { position, update }
}
