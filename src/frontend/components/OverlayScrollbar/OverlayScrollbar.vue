<script setup lang="ts">
// The overlay scrollbar's track and thumb for `target`,
// a scroll element whose native bar is hidden (the
// scroller mixin). It fills its positioned
// parent, which must have the scroller's box, and
// draws a bar over the edge of each axis that
// overflows, taking no layout space.
//
// Dragging the thumb scrolls, and pressing the track
// pages towards the pointer, again while held. The
// tracks only take the pointer while visible, so clicks
// reach the content under a hidden bar. A wheel over a
// visible bar scrolls `target`, as it's not inside it.
import {
  onBeforeUnmount,
  ref,
  type CSSProperties
} from 'vue'
import {
  AXES,
  CORNER,
  INSET,
  THICKNESS,
  useOverlayScrollbar,
  type Axis
} from '@/composables/use-overlay-scrollbar'

const props = defineProps<{
  target: HTMLElement | null | undefined
}>()

const bar = useOverlayScrollbar(() => props.target)
const { bars } = bar

const motion = window.matchMedia?.(
  '(prefers-reduced-motion: reduce)')
/** Shows and hides without the fade. */
const instant = ref(motion?.matches ?? false)
const onMotion = (event: MediaQueryListEvent): void => {
  instant.value = event.matches
}
motion?.addEventListener('change', onMotion)

const px = (n: number): string => `${n}px`

const trackStyle = (axis: Axis): CSSProperties => {
  const end = px(INSET + (bar.both.value ? CORNER : 0))
  const visible = bars[axis].visible
  return {
    ...axis === 'y'
      ? {
          top: px(INSET),
          bottom: end,
          right: px(INSET),
          width: px(THICKNESS)
        }
      : {
          left: px(INSET),
          right: end,
          bottom: px(INSET),
          height: px(THICKNESS)
        },
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    ...instant.value && { transitionDuration: '0s' }
  }
}

const thumbStyle = (axis: Axis): CSSProperties => {
  const { size, offset } = bars[axis]
  return axis === 'y'
    ? { height: px(size), transform: `translateY(${px(offset)})` }
    : { width: px(size), transform: `translateX(${px(offset)})` }
}

const move = (event: PointerEvent): void => {
  bar.moveDrag(event)
}

const letGo = (): void => {
  bar.release()
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', letGo)
  window.removeEventListener('pointercancel', letGo)
}

// On the window, so a drag keeps on outside the area.
const hold = (): void => {
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', letGo)
  window.addEventListener('pointercancel', letGo)
}

const grab = (axis: Axis, event: PointerEvent): void => {
  if (event.button !== 0) return
  event.preventDefault()
  bar.startDrag(axis, event)
  hold()
}

const page = (axis: Axis, event: PointerEvent): void => {
  if (event.button !== 0) return
  event.preventDefault()
  bar.startPaging(axis, event)
  hold()
}

const LINE = 16

const forward = (event: WheelEvent): void => {
  const el = props.target
  if (!el) return
  const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? LINE
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? el.clientHeight
      : 1
  el.scrollBy(event.deltaX * unit, event.deltaY * unit)
}

onBeforeUnmount(() => {
  letGo()
  motion?.removeEventListener('change', onMotion)
})
</script>

<template>
  <div class="overlay-scrollbar" aria-hidden="true">
    <template v-for="axis in AXES" :key="axis">
      <div
        v-if="bars[axis].overflows"
        class="track"
        :class="[`-${axis}`, { '-active': bars[axis].active }]"
        :style="trackStyle(axis)"
        @pointerdown="page(axis, $event)"
        @pointerenter="bar.hover(axis, true)"
        @pointerleave="bar.hover(axis, false)"
        @wheel.prevent="forward"
      >
        <div
          class="thumb"
          :style="thumbStyle(axis)"
          @pointerdown.stop="grab(axis, $event)"
        />
      </div>
    </template>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// The brief's values, as Figma has no scrollbar: the
// text colour at 35%, or 50% hovered or dragged.
.overlay-scrollbar {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;

  > .track {
    position: absolute;
    transition: opacity $duration-fast ease-out;
  }

  // Its length and offset are set inline.
  > .track > .thumb {
    width: 100%;
    height: 100%;
    background: color-mix(
      in sRGB,
      var(--color-text) 35%,
      transparent
    );
    border-radius: 999px;
  }

  > .track.-active > .thumb {
    background: color-mix(
      in sRGB,
      var(--color-text) 50%,
      transparent
    );
  }
}
</style>
