<script setup lang="ts">
// A Transaction's date in the Expense table: the
// Locale's short date, which clicking turns into a
// popover with the day/month/year dropdowns, offering
// no day after `max`. Enter, a click outside or moving
// focus out commits the chosen day, and Escape
// cancels. Focus returns to the date when it closes.
// The popover is placed on the viewport, so the
// table's scrolling box can't clip it.
import {
  computed,
  nextTick,
  ref,
  useTemplateRef,
  type CSSProperties
} from 'vue'
import { isSameDay, parseISO } from 'date-fns'
import { localDate } from '@shared/dates'
import type { LocalDate } from '@shared/storage'
import DatePicker from '@/components/DatePicker.vue'
import { formatDate } from '@/locale/format'

const props = defineProps<{
  date: LocalDate
  /** The latest day offered: today. */
  max: Date
}>()

const emit = defineEmits<{
  commit: [date: LocalDate]
}>()

const day = computed(() => parseISO(props.date))

const isOpen = ref(false)
const chosen = ref(new Date())
const place = ref<CSSProperties>({})
const button = useTemplateRef<HTMLButtonElement>('button')
const popover = useTemplateRef<{ $el: HTMLElement }>(
  'popover'
)

const open = async (): Promise<void> => {
  const rect = button.value?.getBoundingClientRect()
  if (rect) {
    place.value = {
      top: `${rect.bottom}px`,
      left: `${rect.left + rect.width / 2}px`
    }
  }
  chosen.value = day.value
  isOpen.value = true
  await nextTick()
  popover.value?.$el.querySelector('select')?.focus()
}

/** Closes, committing a new day if `save`. */
const close = async (
  save: boolean,
  refocus: boolean
): Promise<void> => {
  if (!isOpen.value) return
  isOpen.value = false
  if (save && !isSameDay(chosen.value, day.value))
    emit('commit', localDate(chosen.value))
  if (!refocus) return
  await nextTick()
  button.value?.focus()
}

const onKeydown = (event: KeyboardEvent): void => {
  // Keeps the keys from the table and the date header.
  event.stopPropagation()
  if (event.key !== 'Enter' && event.key !== 'Escape')
    return
  event.preventDefault()
  void close(event.key === 'Enter', true)
}

const onFocusout = (event: FocusEvent): void => {
  const next = event.relatedTarget
  if (next instanceof Node
    && popover.value?.$el.contains(next))
    return
  // Only focus moving somewhere else commits: a click
  // outside commits through the backdrop instead.
  if (next !== null) void close(true, false)
}
</script>

<template>
  <span class="date-cell">
    <button
      ref="button"
      class="value"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      @click="open"
    >
      <time :datetime="date">
        {{ formatDate(day, 'short') }}
      </time>
    </button>
    <template v-if="isOpen">
      <div
        class="backdrop"
        @pointerdown="close(true, false)"
      />
      <DatePicker
        ref="popover"
        v-model="chosen"
        class="popover"
        role="dialog"
        aria-label="Change the date"
        :style="place"
        :max="max"
        @keydown="onKeydown"
        @focusout="onFocusout"
      />
    </template>
  </span>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.date-cell {
  > .value {
    font: inherit;
    color: inherit;
    border-radius: rem(4px);
    @include focus-ring;
  }

  > .backdrop {
    position: fixed;
    inset: 0;
    z-index: 9;
  }

  // A raised strip below the date, over the table.
  > .popover {
    position: fixed;
    z-index: 10;
    padding: space(1);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: $radius-medium;
    transform: translate(-50%, #{space(1)});
    @include colour-transition;
  }
}
</style>
