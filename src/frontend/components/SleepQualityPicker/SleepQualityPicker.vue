<script setup lang="ts">
// The Sleep Quality Widget's picker for one day, built like MoodPicker: the
// five steps, Poor to Great, with the day's rating preselected. ✓ saves a
// changed choice and the broom clears the day, both through storage; either
// then emits `saved`. Escape emits `close` without saving. A storage error
// shows inline and keeps the picker open.
import { computed, onMounted, ref } from 'vue'
import {
  SLEEP_QUALITY_STEPS,
  type SleepQualityRating
} from '@shared/sleep-quality'
import { localDate } from '@shared/dates'
import type {
  StorageError,
  StorageResult
} from '@shared/storage'
import Icon from '@/components/Icon/Icon.vue'
import Widget from '@/components/Widget/Widget.vue'
import { formatDate } from '@/locale/format'
import { QUALITY_OPACITY } from '@/sleep/quality'
import { dayPill } from '@/theme/semantic'

const props = defineProps<{
  /** The day being rated. */
  date: Date
  /** Its saved rating, if any. */
  current: SleepQualityRating | null
}>()

const emit = defineEmits<{
  /** Storage now holds `rating` (null: cleared). */
  saved: [rating: SleepQualityRating | null]
  /** Closed without changing anything. */
  close: []
}>()

const title = computed(() => `Quality · ${formatDate(props.date, 'long')}`)
const selected = ref<SleepQualityRating | null>(props.current)
const error = ref<string | null>(null)
const busy = ref(false)

const MESSAGES: Partial<Record<StorageError['code'], string>> = {
  'future-date': 'A future day can’t have a rating.'
}

/** Runs one storage call at a time; shows an error or `fallback` on fail. */
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
  if (busy.value) return
  const rating = selected.value
  if (rating === null || rating === props.current) {
    emit('close')
    return
  }
  const saved = await write(
    () => window.bulletin.sleepQuality.create({
      date: localDate(props.date), rating
    }),
    'Couldn’t save the rating. Try again.'
  )
  if (saved) emit('saved', rating)
}

const clear = async (): Promise<void> => {
  const cleared = await write(
    () => window.bulletin.sleepQuality.delete(localDate(props.date)),
    'Couldn’t clear the rating. Try again.'
  )
  if (cleared) emit('saved', null)
}

/** Each step's swatch: the ramp's pill at its step. */
const swatch = (
  rating: SleepQualityRating
): Record<string, string | number> => ({
  background: dayPill('quality').glow,
  opacity: QUALITY_OPACITY[rating]
})

// Roving tabindex over the steps, COLUMNS per row.
const COLUMNS = 2
const options = ref<HTMLButtonElement[]>([])
const focused = ref(Math.max(
  0,
  SLEEP_QUALITY_STEPS.findIndex(step => step.value === props.current)
))

const STEPS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -COLUMNS,
  ArrowDown: COLUMNS
}

const onOptionKeydown = (event: KeyboardEvent, index: number): void => {
  const step = STEPS[event.key]
  if (step !== undefined) {
    const target = index + step
    if (target >= 0 && target < SLEEP_QUALITY_STEPS.length) {
      focused.value = target
      options.value[target]?.focus()
    }
  } else if (event.key === 'Enter' || event.key === ' ') {
    if (event.metaKey || event.ctrlKey) return
    selected.value = SLEEP_QUALITY_STEPS[index].value
  } else return
  event.preventDefault()
  // Keeps the date header's ← → shortcuts out of it.
  event.stopPropagation()
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    if (!busy.value) emit('close')
  } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey))
    void confirm()
  else return
  event.preventDefault()
  event.stopPropagation()
}

// Lets the Widget keep it open while writing.
defineExpose({ busy })
onMounted(() => {
  options.value[focused.value]?.focus()
})
</script>

<template>
  <Widget
    class="sleep-quality-picker"
    :title="title"
    icon="checklist"
    @keydown="onKeydown"
  >
    <template #actions>
      <button
        class="action"
        type="button"
        aria-label="Clear quality"
        :disabled="current === null"
        @click="clear"
      >
        <Icon name="broom" />
      </button>
      <button
        class="action"
        type="button"
        aria-label="Save quality"
        @click="confirm"
      >
        <Icon name="check" />
      </button>
    </template>
    <p id="sleep-quality-picker-label" class="label">
      Select quality
    </p>
    <div
      class="steps"
      role="radiogroup"
      :style="{ '--columns': COLUMNS }"
      aria-labelledby="sleep-quality-picker-label"
    >
      <button
        v-for="(step, i) in SLEEP_QUALITY_STEPS"
        :key="step.value"
        ref="options"
        class="step"
        :class="{ '-selected': selected === step.value }"
        type="button"
        role="radio"
        :aria-checked="selected === step.value"
        :tabindex="i === focused ? 0 : -1"
        @click="selected = step.value; focused = i"
        @keydown="onOptionKeydown($event, i)"
      >
        <span class="swatch" :style="swatch(step.value)" />
        <span class="name">{{ step.label }}</span>
        <Icon v-if="selected === step.value" class="check" name="check" />
      </button>
    </div>
    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// MoodPicker's overlay, with the five steps: tinted cards with the step's
// swatch and name, two per row.
.sleep-quality-picker {
  $tint: color-mix(in sRGB, var(--color-text) 8%, transparent);

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

  .steps {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
    grid-auto-rows: minmax(rem(32px), rem(40px));
    gap: space(1);
  }

  .step {
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

  .step > .swatch {
    flex-shrink: 0;
    align-self: stretch;
    aspect-ratio: 1;
    border-radius: rem(7px);
  }

  .step > .check {
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
