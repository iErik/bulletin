<script setup lang="ts">
// The Mood Widget's picker for one day: the six Moods,
// with the day's current one preselected. ✓ saves a
// changed choice and the eraser clears the day, both
// through storage; either then emits `saved`. Escape
// emits `close` without saving. A storage error shows
// inline and keeps the picker open.
import { computed, onMounted, ref } from 'vue'
import {
  MOODS,
  type MoodKey
} from '@shared/mood'
import { localDate } from '@shared/dates'
import type {
  StorageError,
  StorageResult
} from '@shared/storage'
import Icon from '@/components/Icon.vue'
import Widget from '@/components/Widget.vue'
import { formatDate } from '@/locale/format'
import { moodColour } from '@/theme/semantic'

const props = defineProps<{
  /** The day being edited. */
  date: Date
  /** Its saved Mood, if any. */
  current: MoodKey | null
}>()

const emit = defineEmits<{
  /** Storage now holds `mood` (null: cleared). */
  saved: [mood: MoodKey | null]
  /** Closed without changing anything. */
  close: []
}>()

const title = computed(() =>
  `Mood · ${formatDate(props.date, 'long')}`)

const selected = ref<MoodKey | null>(props.current)
const error = ref<string | null>(null)
const busy = ref(false)

const MESSAGES: Partial<
  Record<StorageError['code'], string>
> = {
  'future-date': 'A future day can’t have a Mood.'
}

/**
 * Runs one storage call at a time. Resolves true on
 * success; on failure shows the error, or `fallback`.
 */
const write = async (
  call: () => Promise<StorageResult<unknown>>,
  fallback: string
): Promise<boolean> => {
  if (busy.value) return false
  busy.value = true
  error.value = null
  const result = await call()
  busy.value = false
  if (result.ok) return true
  error.value = MESSAGES[result.error.code] ?? fallback
  return false
}

/** ✓: saves a changed choice, else just closes. */
const confirm = async (): Promise<void> => {
  const mood = selected.value
  if (mood === null || mood === props.current) {
    emit('close')
    return
  }
  const saved = await write(
    () => window.bulletin.mood.create({
      date: localDate(props.date),
      mood
    }),
    'Couldn’t save the Mood. Try again.'
  )
  if (saved) emit('saved', mood)
}

const clear = async (): Promise<void> => {
  const cleared = await write(
    () => window.bulletin.mood.delete(
      localDate(props.date)
    ),
    'Couldn’t clear the Mood. Try again.'
  )
  if (cleared) emit('saved', null)
}

// Roving tabindex over the Moods, COLUMNS per row.
const COLUMNS = 2
const options = ref<HTMLButtonElement[]>([])
const focused = ref(Math.max(
  0,
  MOODS.findIndex(mood => mood.key === props.current)
))

const STEPS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -COLUMNS,
  ArrowDown: COLUMNS
}

const onOptionKeydown = (
  event: KeyboardEvent,
  index: number
): void => {
  const step = STEPS[event.key]
  if (step !== undefined) {
    const target = index + step
    if (target >= 0 && target < MOODS.length) {
      focused.value = target
      options.value[target]?.focus()
    }
  } else if (event.key === 'Enter' || event.key === ' ') {
    if (event.metaKey || event.ctrlKey) return
    selected.value = MOODS[index].key
  } else return
  event.preventDefault()
  // Keeps the date header's ← → shortcuts out of it.
  event.stopPropagation()
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') emit('close')
  else if (
    event.key === 'Enter'
    && (event.metaKey || event.ctrlKey)
  )
    void confirm()
  else return
  event.preventDefault()
  event.stopPropagation()
}

onMounted(() => {
  options.value[focused.value]?.focus()
})
</script>

<template>
  <Widget
    class="mood-picker"
    :title="title"
    @keydown="onKeydown"
  >
    <template #actions>
      <button
        class="action"
        type="button"
        aria-label="Clear mood"
        :disabled="current === null"
        @click="clear"
      >
        <Icon name="broom" />
      </button>
      <button
        class="action"
        type="button"
        aria-label="Save mood"
        @click="confirm"
      >
        <Icon name="check" />
      </button>
    </template>
    <p id="mood-picker-label" class="label">
      Select mood
    </p>
    <div
      class="moods"
      role="radiogroup"
      :style="{ '--columns': COLUMNS }"
      aria-labelledby="mood-picker-label"
    >
      <button
        v-for="(mood, i) in MOODS"
        :key="mood.key"
        ref="options"
        class="mood"
        :class="{ '-selected': selected === mood.key }"
        type="button"
        role="radio"
        :aria-checked="selected === mood.key"
        :tabindex="i === focused ? 0 : -1"
        @click="selected = mood.key; focused = i"
        @keydown="onOptionKeydown($event, i)"
      >
        <span
          class="swatch"
          :style="{ background: moodColour(mood) }"
        />
        <span class="name">{{ mood.label }}</span>
        <Icon
          v-if="selected === mood.key"
          class="check"
          name="check"
        />
      </button>
    </div>
    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma's "Select mood" overlay: tinted cards with a
// swatch and the Mood's name, two per row.
.mood-picker {
  $tint: color-mix(
    in sRGB,
    var(--color-text) 8%,
    transparent
  );

  .action {
    display: grid;
    place-items: center;
    width: rem(28px);
    height: rem(28px);
    font-size: rem(15px);
    color: var(--color-text-muted);
    background: $tint;
    border-radius: rem(6px);
    @include colour-transition;
    @include focus-ring;

    &:disabled {
      cursor: default;
      opacity: 0.4;
    }
  }

  .label {
    margin-bottom: space(2);
    font-size: rem(11px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .moods {
    display: grid;
    grid-template-columns:
      repeat(var(--columns), minmax(0, 1fr));
    grid-auto-rows: minmax(rem(32px), rem(40px));
    gap: space(1);
  }

  .mood {
    display: flex;
    gap: rem(11px);
    align-items: center;
    padding: rem(6px) space(2);
    font-size: rem(11px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text);
    background: $tint;
    border-radius: rem(9px);
    @include colour-transition;
    @include focus-ring;

    &.-selected {
      background: var(--color-surface);
    }
  }

  .mood > .swatch {
    flex-shrink: 0;
    align-self: stretch;
    aspect-ratio: 1;
    border-radius: rem(7px);
  }

  .mood > .check {
    margin-left: auto;
    color: var(--color-text-muted);
  }

  .error {
    margin-top: space(1);
    font-size: rem(11px);
    color: var(--color-text);
  }
}
</style>
