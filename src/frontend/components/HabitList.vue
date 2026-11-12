<script setup lang="ts">
// The Habits Widget's Habit list: a row per active
// Habit with its icon, name and "N / D days", and ✓ on
// the current one. Clicking a row, or Enter on it,
// emits `choose`. "−" asks "Delete?"; ✓ archives the
// Habit through storage and emits `archived`, while ×,
// Escape, a click or focus elsewhere cancels. ↑ ↓ Home
// End move between rows; Tab reaches a row's buttons.
// ✏️ turns a row into the Habit editor, and the last
// row, "+ Track a new habit…", into an empty one that
// emits `created` and stays open. Only one row at a
// time edits or asks "Delete?".
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import { Check, Minus, Pencil, Plus, X }
  from '@lucide/vue'
import type { Habit } from '@shared/habits'
import HabitEditor from '@/components/HabitEditor.vue'
import { HABIT_ICON_COMPONENTS } from '@/habits/icons'
import { formatNumber } from '@/locale/format'

const props = defineProps<{
  /** The active Habits, oldest first. */
  habits: readonly Habit[]
  /** The current Habit's id, if any. */
  current: number | null
  /** A Habit's done days in the month. */
  done: (habit: Habit) => number
  /** The number of days in the month. */
  days: number
  /** Opens with the new-habit field focused. */
  creating?: boolean
}>()

const emit = defineEmits<{
  choose: [habit: Habit]
  /** Storage has archived it. */
  archived: [habit: Habit]
  /** Storage has created or restored it. */
  created: [habit: Habit]
  /** Storage has saved its changes. */
  updated: [habit: Habit]
}>()

const count = (habit: Habit): string =>
  `${formatNumber(props.done(habit))} / `
  + `${formatNumber(props.days)} days`

const root = useTemplateRef<HTMLElement>('root')

/** The first element in DOM order matching `selector`. */
const find = (selector: string): HTMLElement | null =>
  root.value?.querySelector(selector) ?? null

// Roving tabindex over the rows; the new-habit row's
// index is the number of Habits.
const focused = ref(props.creating
  ? props.habits.length
  : Math.max(0, props.habits
      .findIndex(habit => habit.id === props.current)))

const focusRow = (index: number): void => {
  focused.value = index
  find(`.row:nth-child(${index + 1}) > .choose`)
    ?.focus()
}

const TARGETS: Readonly<Record<
  string,
  (index: number, last: number) => number
>> = {
  ArrowUp: i => Math.max(0, i - 1),
  ArrowDown: (i, last) => Math.min(last, i + 1),
  Home: () => 0,
  End: (_, last) => last
}

const onRowKeydown = (
  event: KeyboardEvent,
  index: number
): void => {
  const target = TARGETS[event.key]
  if (!target) return
  event.preventDefault()
  // Keeps the date header's shortcuts out of it.
  event.stopPropagation()
  focusRow(target(index, props.habits.length))
}

type RowMode = 'edit' | 'delete'
/** A Habit's id, or `new` for the new-habit row. */
type RowId = number | 'new'

/** The row editing or asking "Delete?", if any. */
const active = ref<{ mode: RowMode; id: RowId } | null>(
  props.creating ? { mode: 'edit', id: 'new' } : null
)
/** Archiving, or the editor saving. */
const busy = ref(false)
const error = ref<string | null>(null)

const isActive = (mode: RowMode, id: RowId): boolean =>
  active.value?.mode === mode && active.value.id === id

const openRow = (mode: RowMode, index: number): boolean => {
  if (busy.value) return false
  focused.value = index
  active.value = {
    mode,
    id: props.habits.at(index)?.id ?? 'new'
  }
  error.value = null
  return true
}

const askDelete = async (index: number): Promise<void> => {
  if (!openRow('delete', index)) return
  await nextTick()
  find('.controls > .-confirm')?.focus()
}

const cancel = async (refocus: boolean): Promise<void> => {
  if (busy.value || active.value === null) return
  const { id } = active.value
  active.value = null
  error.value = null
  if (!refocus) return
  await nextTick()
  const index = props.habits
    .findIndex(habit => habit.id === id)
  focusRow(index < 0 ? props.habits.length : index)
}

const archive = async (index: number): Promise<void> => {
  if (busy.value) return
  const habit = props.habits[index]
  busy.value = true
  const result = await window.bulletin.habits
    .archive(habit.id)
  busy.value = false
  if (!result.ok) {
    error.value = 'Couldn’t delete the Habit. Try again.'
    // Disabling ✓ dropped focus; give it back to retry.
    await nextTick()
    if (document.activeElement === document.body)
      find('.controls > .-confirm')?.focus()
    return
  }
  active.value = null
  emit('archived', habit)
  await nextTick()
  focusRow(Math.min(index, props.habits.length - 1))
}

const onUpdated = async (habit: Habit): Promise<void> => {
  emit('updated', habit)
  await cancel(true)
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape'
    || active.value?.mode !== 'delete') return
  event.preventDefault()
  event.stopPropagation()
  void cancel(true)
}

// A click or focus outside the asking row cancels.
const onOutside = (event: Event): void => {
  const row = find(`[data-id="${active.value?.id}"]`)
  if (row && event.composedPath().includes(row)) return
  void cancel(false)
}

const EVENTS = ['pointerdown', 'focusin'] as const

watch(() => active.value?.mode === 'delete', asking => {
  const method = asking
    ? 'addEventListener'
    : 'removeEventListener'
  for (const name of EVENTS)
    document[method](name, onOutside)
})

onBeforeUnmount(() => {
  for (const name of EVENTS)
    document.removeEventListener(name, onOutside)
})

// Lets the Habits Widget keep it open while writing.
defineExpose({ busy })

onMounted(() => {
  focusRow(focused.value)
})
</script>

<template>
  <div ref="root" class="habit-list" @keydown="onKeydown">
    <ul class="rows" aria-label="Habits">
      <li
        v-for="(habit, i) in habits"
        :key="habit.id"
        class="row"
        :class="{ '-current': habit.id === current }"
        :data-id="habit.id"
        @keydown="onRowKeydown($event, i)"
      >
        <HabitEditor
          v-if="isActive('edit', habit.id)"
          v-model:busy="busy"
          :habit="habit"
          @saved="onUpdated"
          @cancel="cancel(true)"
        />
        <button
          v-else
          class="choose"
          type="button"
          :tabindex="i === focused ? 0 : -1"
          :aria-current="habit.id === current"
          @click="emit('choose', habit)"
          @focus="focused = i"
        >
          <component
            :is="HABIT_ICON_COMPONENTS[habit.icon]"
            class="icon"
            aria-hidden="true"
          />
          <span class="name">{{ habit.name }}</span>
          <span class="count">{{ count(habit) }}</span>
        </button>
        <div
          v-if="isActive('delete', habit.id)"
          class="controls"
          role="group"
          :aria-label="`Delete ${habit.name}?`"
        >
          <span class="question">Delete?</span>
          <button
            class="control -confirm"
            type="button"
            aria-label="Delete"
            :disabled="busy"
            @click="archive(i)"
          >
            <Check class="icon" aria-hidden="true" />
          </button>
          <button
            class="control"
            type="button"
            aria-label="Don’t delete"
            :disabled="busy"
            @click="cancel(true)"
          >
            <X class="icon" aria-hidden="true" />
          </button>
        </div>
        <div
          v-else-if="!isActive('edit', habit.id)"
          class="controls"
        >
          <button
            class="control"
            type="button"
            :tabindex="i === focused ? 0 : -1"
            :aria-label="`Edit ${habit.name}`"
            @click="openRow('edit', i)"
          >
            <Pencil class="icon" aria-hidden="true" />
          </button>
          <button
            class="control"
            type="button"
            :tabindex="i === focused ? 0 : -1"
            :aria-label="`Delete ${habit.name}`"
            @click="askDelete(i)"
          >
            <Minus class="icon" aria-hidden="true" />
          </button>
          <Check
            v-if="habit.id === current"
            class="icon -check"
            aria-hidden="true"
          />
        </div>
      </li>
      <li
        class="row -new"
        data-id="new"
        @keydown="onRowKeydown($event, habits.length)"
      >
        <HabitEditor
          v-if="isActive('edit', 'new')"
          v-model:busy="busy"
          @saved="emit('created', $event)"
          @cancel="cancel(true)"
        />
        <button
          v-else
          class="choose"
          type="button"
          :tabindex="habits.length === focused ? 0 : -1"
          @click="openRow('edit', habits.length)"
          @focus="focused = habits.length"
        >
          <Plus class="icon" aria-hidden="true" />
          <span class="name">Track a new habit…</span>
        </button>
      </li>
    </ul>
    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma's "Habit Selection": tinted rows, the current
// one fainter, each with "−" and ✓ on the right.
.habit-list {
  $tint: color-mix(
    in sRGB,
    var(--color-text) 8%,
    transparent
  );

  display: flex;
  flex-direction: column;
  height: 100%;

  > .rows {
    display: flex;
    flex-direction: column;
    gap: rem(4px);
    min-height: 0;
    overflow-y: auto;
  }

  .row {
    display: flex;
    flex-shrink: 0;
    gap: space(1);
    align-items: center;
    min-height: rem(44px);
    padding-right: rem(10px);
    color: var(--color-text-muted);
    background: $tint;
    border-radius: rem(9px);
    @include colour-transition;

    &.-current {
      background: color-mix(
        in sRGB,
        var(--color-text) 4%,
        transparent
      );
    }
  }

  .choose {
    display: grid;
    flex: 1;
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: rem(9px);
    align-items: center;
    align-self: stretch;
    min-width: 0;
    padding: rem(6px) rem(10px);
    text-align: left;
    border-radius: rem(9px);
    @include focus-ring;
  }

  .choose > .icon {
    grid-row: span 2;
    width: rem(14px);
    height: rem(14px);
  }

  .choose > .name {
    overflow: hidden;
    font-size: rem(13px);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .choose > .count {
    font-size: rem(10px);
    opacity: 0.6;
  }

  .controls {
    display: flex;
    gap: rem(6px);
    align-items: center;
  }

  .question {
    font-size: rem(11px);
    font-weight: 700;
    text-transform: uppercase;
  }

  .control {
    display: grid;
    place-items: center;
    width: rem(22px);
    height: rem(22px);
    border-radius: rem(6px);
    @include focus-ring;

    &:hover { background: $tint; }

    &:disabled {
      cursor: default;
      opacity: 0.4;
    }
  }

  .icon {
    width: rem(16px);
    height: rem(16px);
  }

  .icon.-check { margin: 0 rem(3px); }

  .row.-new > .choose > .icon { grid-row: auto; }

  > .error {
    margin-top: space(1);
    font-size: rem(11px);
    color: var(--color-text);
  }
}
</style>
