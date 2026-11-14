<script setup lang="ts">
// A table cell's value, edited in place: a button
// showing `text`, which clicking turns into an input
// starting at `start`. Enter or clicking away commits
// it, and Escape reverts. `check` says why typed text
// can't be saved: on Enter the input stays, marked
// invalid, and clicking away reverts. Either way the
// reason goes out as `invalid`, for the Widget to
// show, and typing or Escape clears it. Cut-off text
// shows in full on hover or focus.
import { nextTick, ref, useTemplateRef } from 'vue'
import Tooltip from '@/components/Tooltip/Tooltip.vue'

const props = withDefaults(
  defineProps<{
    /** The value shown. */
    text: string
    /** What the input starts with. */
    start: string
    /** The input's accessible name. */
    label: string
    inputmode?: 'text' | 'decimal'
    /** Why `text` can't be saved, or null if it can. */
    check?: (text: string) => string | null
  }>(),
  { inputmode: 'text', check: () => null }
)

const emit = defineEmits<{
  commit: [text: string]
  invalid: [reason: string | null]
}>()

const editing = ref(false)
const draft = ref('')
const isInvalid = ref(false)
const field = useTemplateRef<HTMLInputElement>('field')
const button = useTemplateRef<HTMLButtonElement>('button')

const open = async (): Promise<void> => {
  draft.value = props.start
  isInvalid.value = false
  editing.value = true
  await nextTick()
  field.value?.focus()
  field.value?.select()
}

/** Back to the value; `refocus` moves focus to it. */
const close = async (refocus: boolean): Promise<void> => {
  editing.value = false
  if (!refocus) return
  await nextTick()
  button.value?.focus()
}

/** Commits valid text; `fromKey` if Enter asked. */
const commit = (fromKey: boolean): void => {
  const reason = props.check(draft.value)
  if (reason !== null) {
    emit('invalid', reason)
    if (fromKey) isInvalid.value = true
    else void close(false)
    return
  }
  emit('commit', draft.value)
  void close(fromKey)
}

const onKeydown = (event: KeyboardEvent): void => {
  // Keeps the keys from the table and the date header.
  event.stopPropagation()
  if (event.key === 'Enter') {
    event.preventDefault()
    commit(true)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    emit('invalid', null)
    void close(true)
  }
}

const onBlur = (): void => {
  if (editing.value) commit(false)
}

const onInput = (): void => {
  isInvalid.value = false
  emit('invalid', null)
}
</script>

<template>
  <input
    v-if="editing"
    ref="field"
    v-model="draft"
    class="cell-input -field"
    type="text"
    :inputmode="inputmode"
    autocomplete="off"
    :aria-label="label"
    :aria-invalid="isInvalid"
    @input="onInput"
    @keydown="onKeydown"
    @blur="onBlur"
  >
  <Tooltip
    v-else
    class="cell-input"
    :text="text"
    placement="above"
    truncated-only
  >
    <button
      ref="button"
      class="value"
      type="button"
      @click="open"
    >
      {{ text }}
    </button>
  </Tooltip>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.cell-input {
  max-width: 100%;

  > .value {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    font: inherit;
    text-align: inherit;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: inherit;
    border-radius: rem(4px);
    @include focus-ring;
  }

  // Sits where the value's text sits, unmarked: the
  // caret shows where focus is, so no ring or border.
  &.-field {
    width: 100%;
    padding: 0;
    font: inherit;
    color: var(--color-text);
    text-align: inherit;
    background: none;
    border: 0;
    border-radius: rem(4px);
    outline: none;

    &::placeholder { color: var(--color-text-muted); }

    &[aria-invalid='true'] {
      outline: 1px solid var(--color-danger);
    }
  }
}
</style>
