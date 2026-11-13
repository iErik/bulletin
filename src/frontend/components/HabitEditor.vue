<script setup lang="ts">
// The Habit editor: an icon picker and a name field,
// for creating a Habit or, given one, editing it. Enter
// or ✓ saves through storage and emits `saved`; Escape
// or × emits `cancel`. The name is trimmed and must not
// be empty; storage rejects names other Habits use.
// After creating, it clears for the next Habit. `busy`
// is true while saving.
import {
  nextTick,
  onMounted,
  ref,
  useTemplateRef
} from 'vue'
import type { Habit, HabitIcon } from '@shared/habits'
import type { StorageError, StorageResult }
  from '@shared/storage'
import HabitIconPicker
  from '@/components/HabitIconPicker.vue'
import Icon from '@/components/Icon.vue'

const props = defineProps<{
  /** The Habit to edit; creates one without it. */
  habit?: Habit
}>()

const emit = defineEmits<{
  saved: [habit: Habit]
  cancel: []
}>()

const busy = defineModel<boolean>('busy')

const DEFAULT_ICON: HabitIcon = 'meditation'

const name = ref(props.habit?.name ?? '')
const icon = ref(props.habit?.icon ?? DEFAULT_ICON)
const error = ref<string | null>(null)
const field = useTemplateRef<HTMLInputElement>('field')

const message = (failure: StorageError): string => {
  if (failure.code !== 'name-taken')
    return 'Couldn’t save the Habit. Try again.'
  return failure.habit === 'archived'
    ? 'An archived habit uses this name. '
      + 'Create it to restore it.'
    : 'Another habit uses this name.'
}

/** Writes the Habit through storage. */
const write = (
  trimmed: string
): Promise<StorageResult<Habit>> => {
  const { habits } = window.bulletin
  const fields = { name: trimmed, icon: icon.value }
  return props.habit
    ? habits.update({ id: props.habit.id, ...fields })
    : habits.create(fields)
}

const save = async (): Promise<void> => {
  if (busy.value) return
  const trimmed = name.value.trim()
  error.value = trimmed ? null : 'Give the habit a name.'
  if (error.value) return
  busy.value = true
  const result = await write(trimmed)
  busy.value = false
  if (!result.ok) error.value = message(result.error)
  else {
    emit('saved', result.value)
    if (props.habit) return
    name.value = ''
    icon.value = DEFAULT_ICON
  }
  // Disabling ✓ may have dropped focus.
  await nextTick()
  field.value?.focus()
}

const onKeydown = (event: KeyboardEvent): void => {
  // Keeps the keys from the row, list and date header.
  event.stopPropagation()
  if (event.key !== 'Escape') return
  event.preventDefault()
  if (!busy.value) emit('cancel')
}

onMounted(() => {
  field.value?.focus()
})
</script>

<template>
  <form
    class="habit-editor"
    @submit.prevent="save"
    @keydown="onKeydown"
  >
    <HabitIconPicker v-model="icon" />
    <input
      ref="field"
      v-model="name"
      class="field"
      type="text"
      placeholder="Habit name"
      :aria-label="habit ? 'Habit name' : 'New habit name'"
      :aria-invalid="error !== null"
    >
    <button
      class="control"
      type="submit"
      :aria-label="habit ? 'Save' : 'Create'"
      :disabled="busy"
    >
      <Icon name="check" />
    </button>
    <button
      class="control"
      type="button"
      aria-label="Cancel"
      :disabled="busy"
      @click="emit('cancel')"
    >
      <Icon name="close" />
    </button>
    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>
  </form>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.habit-editor {
  display: grid;
  flex: 1;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  gap: rem(6px);
  align-items: center;
  padding: rem(6px) 0 rem(6px) rem(6px);

  > .field {
    min-width: 0;
    padding: rem(4px) rem(6px);
    font-size: rem(13px);
    font-weight: 500;
    color: var(--color-text);
    background: transparent;
    border-radius: rem(6px);
    @include focus-ring;

    &::placeholder { color: var(--color-text-muted); }
  }

  > .error {
    grid-column: 1 / -1;
    font-size: rem(11px);
    color: var(--color-text);
  }
}
</style>
