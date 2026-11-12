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
    placement?: 'end' | 'above'
    truncatedOnly?: boolean
  }>(),
  { delay: 400, placement: 'end' }
)

const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
/** Where an `above` bubble goes, on the viewport. */
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

function show(): void {
  clearTimeout(timer)
  if (props.truncatedOnly && !truncated()) return
  timer = setTimeout(() => {
    const rect = root.value?.getBoundingClientRect()
    if (rect) {
      anchor.value = {
        top: `${rect.top}px`,
        left: `${rect.left + rect.width / 2}px`
      }
    }
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
    <span
      v-if="open"
      class="bubble"
      :class="`-${placement}`"
      :style="placement === 'above' ? anchor : undefined"
      aria-hidden="true"
    >
      {{ text }}
    </span>
  </span>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.app-tooltip {
  position: relative;
  display: inline-flex;

  // Inverted colours, so it stands out over any
  // surface in either Scheme.
  > .bubble {
    position: absolute;
    top: 50%;
    left: calc(100% + #{space(3)});
    z-index: 10;
    padding: space(1) space(2);
    font-size: rem(12px);
    line-height: 1.4;
    white-space: nowrap;
    color: var(--color-surface);
    background: var(--color-text);
    border-radius: $radius-small;
    transform: translateY(-50%);
    pointer-events: none;
  }

  > .bubble.-above {
    position: fixed;
    max-width: rem(280px);
    overflow-wrap: anywhere;
    white-space: normal;
    transform: translate(-50%, calc(-100% - #{space(1)}));
  }
}
</style>
