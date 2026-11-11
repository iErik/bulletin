<script setup lang="ts">
// A short label beside its trigger (the default slot),
// towards the content. It shows after `delay` ms of
// hover or keyboard focus, and hides on leave, blur or
// Escape. Screen readers skip it: the trigger carries
// the same text as its accessible name.
import { onBeforeUnmount, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    text: string
    /** Milliseconds before it shows. */
    delay?: number
  }>(),
  { delay: 400 }
)

const open = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') hide()
}

function show(): void {
  clearTimeout(timer)
  timer = setTimeout(() => {
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
    class="app-tooltip"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />
    <span v-if="open" class="bubble" aria-hidden="true">
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
}
</style>
