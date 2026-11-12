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

const trigger = ref<HTMLButtonElement>()
const isOpen = ref(false)

const isEditable = (
  target: EventTarget | null
): boolean =>
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

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="date-header">
    <button
      class="step no-drag"
      type="button"
      aria-label="Previous day"
      @click="store.step(-1)"
    >
      ‹
    </button>
    <button
      ref="trigger"
      class="date no-drag"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      {{ label }}
    </button>
    <button
      class="step no-drag"
      type="button"
      aria-label="Next day"
      :disabled="store.isToday"
      @click="store.step(1)"
    >
      ›
    </button>
    <button
      class="today no-drag"
      type="button"
      :disabled="store.isToday"
      @click="store.goToday()"
    >
      Today
    </button>
    <!-- Catches outside clicks. No-drag, as Electron
      sends no events from the Title Bar's drag area. -->
    <div
      v-if="isOpen"
      class="backdrop no-drag"
      @pointerdown="isOpen = false"
    />
    <DatePicker
      v-if="isOpen"
      class="popover no-drag"
      role="dialog"
      aria-label="Choose a date"
      :model-value="store.day"
      :max="store.today"
      @update:model-value="store.setDay"
    />
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
  font-size: rem(13px);
  font-weight: 500;
  letter-spacing: 0.08em;
  color: var(--color-text);

  > .step,
  > .date,
  > .today {
    position: relative; // Above the backdrop
    z-index: 10;
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

  > .backdrop {
    position: fixed;
    inset: 0;
    z-index: 9;
  }

  // A raised strip below the header, over the page
  // and the backdrop.
  > .popover {
    position: absolute;
    top: calc(100% + #{space(1)});
    left: 50%;
    z-index: 10;
    padding: space(1);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: $radius-medium;
    transform: translateX(-50%);
    @include colour-transition;
  }
}
</style>
