<script setup lang="ts">
// A short label beside its trigger (the default slot),
// towards the content, or above it. It shows after
// `delay` ms of hover or keyboard focus, and hides on
// leave, blur or Escape. Screen readers skip it: the
// trigger carries the same text as its accessible
// name. With `truncatedOnly`, it shows only while the
// trigger's text is cut off. Above, it's placed on the
// viewport, so a scrolling box can't clip it.
import {
  onBeforeUnmount,
  ref,
  useTemplateRef,
  type CSSProperties
} from 'vue'

const props = withDefaults(
  defineProps<{
    text: string
    /** Milliseconds before it shows. */
    delay?: number
    placement?: 'top' | 'bottom' | 'left' | 'right'
    truncatedOnly?: boolean
    forceOpen?: boolean
    position?: {
      top?: string
      left?: string
      right?: string
      bottom?: string
    } | null
  }>(),
  { delay: 400, placement: 'top', position: null }
)

const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
const bubble = useTemplateRef<HTMLElement>('bubble')
const anchor = ref<CSSProperties>({})
let timer: ReturnType<typeof setTimeout> | undefined

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') hide()
}

/** Whether the trigger's text overflows its box. */
const truncated = (): boolean => {
  const trigger = root.value?.firstElementChild
  return !!trigger
    && trigger.scrollWidth > trigger.clientWidth
}

function getPosition(): { top: string; left: string } | null {
  const rRect = root.value?.getBoundingClientRect()
  const bRect = bubble.value?.getBoundingClientRect()

  if (!rRect || !bRect) return null

  switch (props.placement) {
    case 'top': return {
      top: `${rRect.top - bRect.height}px`,
      left: `${(rRect.left + rRect.width / 2) - (bRect.width / 2)}px`
    }
    case 'bottom': return {
      top: `${rRect.top + rRect.height}px`,
      left: `${(rRect.left + rRect.width / 2) - (bRect.width / 2)}px`
    }
    case 'left': return {
      top: `${(rRect.top + rRect.height / 2) - (bRect.height / 2)}px`,
      left: `${rRect.left + rRect.width}px`
    }
    case 'right': return {
      top: `${(rRect.top + rRect.height / 2) - (bRect.height / 2)}px`,
      left: `${rRect.left - bRect.width}px`
    }
  }
}

function show(): void {
  clearTimeout(timer)
  if (props.truncatedOnly && !truncated()) return

  timer = setTimeout(() => {
    const position = getPosition()

    if (position)
      anchor.value = position

    open.value = true
  }, props.delay)

  window.addEventListener('keydown', onKeydown)
}

function hide(): void {
  clearTimeout(timer)

  open.value = false
  window.removeEventListener('keydown', onKeydown)
}

onBeforeUnmount(hide)
</script>

<template>
  <span
    ref="root"
    class="app-tooltip"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />

    <Teleport to="body">
      <span
        v-if="open || props.forceOpen"
        ref="bubble"
        class="app-tooltip-bubble"
        :class="`-${placement}`"
        :style="props.position || anchor"
        aria-hidden="true"
      >
        {{ text }}
      </span>
    </Teleport>
  </span>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.app-tooltip {
  position: relative;
  display: inline-flex;
}

.app-tooltip-bubble {
  position: fixed;
  z-index: 10;
  padding: space(1) space(2);
  font-size: rem(12px);
  line-height: 1.4;
  color: var(--color-surface);
  background: var(--color-text);
  border-radius: $radius-small;
  pointer-events: none;
  max-width: rem(280px);
  overflow-wrap: anywhere;
  white-space: normal;

  &.-top { transform: translateY(-10px); }
  &.-bottom { transform: translateY(10px); }
  &.-right { transform: translateX(-10px); }
  &.-left { transform: translateX(10px); }
}
</style>
