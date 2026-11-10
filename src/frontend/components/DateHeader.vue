<script setup lang="ts">
// The date header, shown in the Title Bar: the
// Selected Date in the Locale's long format, ‹ › to
// step a day, "Today", and the date text opening the
// day/month/year popover. It's the only thing that
// changes the Selected Date, also from the keyboard:
// ← and → step a day and T goes to today, while
// nothing editable has focus.
import { computed, onBeforeUnmount, onMounted, ref }
  from 'vue'
import DatePicker from '@/components/DatePicker.vue'
import { formatDate } from '@/locale/format'
import { useSelectedDateStore }
  from '@/stores/selected-date'

const store = useSelectedDateStore()

const label = computed(() => formatDate(store.day, 'long'))

const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const isOpen = ref(false)

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement
  && (target.isContentEditable
    || target.closest('input, textarea, select')
      !== null)

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
    trigger.value?.focus()
    return
  }
  const hasModifier = event.metaKey || event.ctrlKey
    || event.altKey
  if (hasModifier || isEditable(event.target)) return

  if (event.key === 'ArrowLeft') store.step(-1)
  else if (event.key === 'ArrowRight') store.step(1)
  else if (event.key.toLowerCase() === 't')
    store.goToday()
  else return
  event.preventDefault()
}

// Closes the popover on a press anywhere outside the
// header, the popover included.
const onPointerdown = (event: PointerEvent): void => {
  const target = event.target as Node | null
  if (!root.value?.contains(target)) isOpen.value = false
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerdown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener(
    'pointerdown', onPointerdown
  )
})
</script>

<template>
  <div ref="root" class="date-header">
    <button
      class="step no-drag" type="button"
      aria-label="Previous day"
      @click="store.step(-1)"
    >
      ‹
    </button>
    <button
      ref="trigger"
      class="date no-drag" type="button"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      {{ label }}
    </button>
    <button
      class="step no-drag" type="button"
      aria-label="Next day"
      :disabled="store.isToday"
      @click="store.step(1)"
    >
      ›
    </button>
    <button
      class="today no-drag" type="button"
      :disabled="store.isToday"
      @click="store.goToday()"
    >
      Today
    </button>
    <DatePicker v-if="isOpen" class="popover" />
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Small uppercase text, as the Figma Title Bar's date.
.date-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: space(1);
  font-size: rem(12px);
  letter-spacing: 0.08em;
  color: var(--color-text);

  > .step,
  > .date,
  > .today {
    padding: space(1) space(2);
    color: inherit;
    text-transform: uppercase;
    border-radius: $radius-small;
    @include colour-transition;
    @include focus-ring;

    &:hover:not(:disabled) {
      background: var(--color-surface-raised);
    }

    &:disabled {
      color: var(--color-text-muted);
      cursor: default;
      opacity: 0.5;
    }
  }

  > .step {
    font-size: rem(16px);
    line-height: 1;
  }

  > .today {
    color: var(--color-text-muted);
  }

  // Below the header, over the page.
  > .popover {
    position: absolute;
    top: calc(100% + #{space(1)});
    left: 50%;
    z-index: 10;
    transform: translateX(-50%);
  }
}
</style>
