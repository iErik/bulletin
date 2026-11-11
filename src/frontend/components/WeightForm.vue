<script setup lang="ts">
// The Weight Widget's "Add new entry" form: a date, no
// later than today, and a value in kg. ✓ or Enter saves
// a valid value through storage, then emits `saved`;
// × or Escape emits `close` without saving. When the
// day already has an Entry, a notice says the save
// replaces it. A storage error shows inline and keeps
// the form open with its input.
import {
  computed,
  onMounted,
  ref,
  shallowRef,
  useId,
  useTemplateRef,
  watch
} from 'vue'
import { localDate } from '@shared/dates'
import type { StorageError } from '@shared/storage'
import type { WeightEntry } from '@shared/weight'
import DatePicker from '@/components/DatePicker.vue'
import Icon from '@/components/Icon.vue'
import Widget from '@/components/Widget.vue'
import { formatWeight, parseKg } from '@/weight/format'

const props = defineProps<{
  /** The day the form opens on. */
  day: Date
  /** The latest day it offers. */
  today: Date
}>()

const emit = defineEmits<{
  /** Storage now holds `entry`. */
  saved: [entry: WeightEntry]
  /** Closed without saving. */
  close: []
}>()

const date = shallowRef(props.day)
const text = ref('')
const grams = computed(() => parseKg(text.value))
const invalid = computed(() =>
  text.value.trim() !== '' && grams.value === null)

const error = ref<string | null>(null)
const busy = ref(false)

const MESSAGES: Partial<
  Record<StorageError['code'], string>
> = {
  'future-date': 'A future day can\'t have a weight.'
}
const FALLBACK = 'Couldn\'t save your weight. Try again.'

/** The chosen day's Entry, which a save replaces. */
const existing = shallowRef<WeightEntry | null>(null)
// Bumped by each lookup, so one it overtook is dropped.
let generation = 0

watch(date, async day => {
  const asked = ++generation
  existing.value = null
  const result = await window.bulletin.weight.list({
    from: localDate(day),
    to: localDate(day)
  })
  if (asked !== generation) return
  existing.value = result.ok ? result.value[0] ?? null : null
}, { immediate: true })

const save = async (): Promise<void> => {
  if (busy.value || grams.value === null) return
  busy.value = true
  error.value = null
  const result = await window.bulletin.weight.create({
    date: localDate(date.value),
    grams: grams.value
  })
  busy.value = false
  if (result.ok) emit('saved', result.value)
  else error.value = MESSAGES[result.error.code] ?? FALLBACK
}

const cancel = (): void => {
  if (!busy.value) emit('close')
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') cancel()
  else if (event.key === 'Enter') {
    // A focused button handles Enter itself.
    if (event.target instanceof HTMLButtonElement) return
    void save()
  } else return
  event.preventDefault()
  // Keeps the date header's shortcuts out of it.
  event.stopPropagation()
}

const id = useId()
const input = useTemplateRef<HTMLInputElement>('input')

onMounted(() => input.value?.focus())
</script>

<template>
  <Widget
    class="weight-form"
    title="Add new entry"
    @keydown="onKeydown"
  >
    <template #actions>
      <button
        class="action"
        type="button"
        aria-label="Save weight"
        :disabled="grams === null || busy"
        @click="save"
      >
        <Icon name="check" />
      </button>
      <button
        class="action"
        type="button"
        aria-label="Cancel"
        @click="cancel"
      >
        <Icon name="close" />
      </button>
    </template>
    <fieldset class="field">
      <legend class="label">
        Date
      </legend>
      <DatePicker v-model="date" :max="today" />
    </fieldset>
    <div class="field">
      <label class="label" :for="id">Value</label>
      <span class="value">
        <input
          :id="id"
          ref="input"
          v-model="text"
          class="input"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          :aria-invalid="invalid"
        >
        <span class="unit" aria-hidden="true">kg</span>
      </span>
    </div>
    <p v-if="error" class="message" role="alert">
      {{ error }}
    </p>
    <p v-else-if="existing" class="message">
      Replaces {{ formatWeight(existing.grams) }}
      logged on this day
    </p>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma's "Add new entry" frame: labelled fields
// under ✓ and ×, whose look the Weight Widget sets.
.weight-form {
  .field {
    margin: 0 0 space(2);
    padding: 0;
    border: 0;
  }

  .label {
    display: block;
    margin-bottom: space(1);
    font-size: rem(11px);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .value {
    display: inline-flex;
    align-items: center;
    gap: space(1);
    padding: space(1) space(2);
    background: var(--color-surface);
    border-radius: $radius-small;
    @include colour-transition;

    &:focus-within {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  .input {
    width: rem(64px);
    font-size: rem(12px);
    color: var(--color-text);
    background: transparent;
    border: 0;
    outline: none;
  }

  .unit {
    font-size: rem(12px);
    color: var(--color-text-muted);
  }

  .message {
    font-size: rem(11px);
    color: var(--color-text);
  }
}
</style>
