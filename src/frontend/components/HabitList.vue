<script setup lang="ts">
// The Habits Widget's Habit list: a row per active
// Habit with its icon, name and "N / D days", and ✓ on
// the current one. Clicking a row, or Enter on it,
// emits `choose`. "−" asks "Delete?"; ✓ archives the
// Habit through storage and emits `archived`, while ×,
// Escape, a click or focus elsewhere cancels. A Habit
// storage no longer has counts as archived. ↑ ↓ Home
// End move between rows; Tab reaches a row's buttons.
// ✏️ turns a row into the Habit editor, and the last
// row, "+ Track a new habit…", into an empty one that
// emits `created` and stays open. Only one row at a
// time edits or asks "Delete?".
import {
  computed,
  nextTick,
  onMounted,
  ref,
  useTemplateRef
} from 'vue'
// Figma has no edit icon: BLT-88's design override keeps
// Lucide's pencil until it draws one.
import { Pencil } from '@lucide/vue'
import type { Habit } from '@shared/habits'
import HabitEditor from '@/components/HabitEditor.vue'
import Icon from '@/components/Icon.vue'
import { useRowDeleteConfirm }
  from '@/composables/use-row-delete-confirm'
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

const isActive = (mode: RowMode, id: RowId): boolean =>
  active.value?.mode === mode && active.value.id === id

const {
  error,
  ask,
  cancel: cancelDelete,
  confirm: archive,
  onKeydown
} = useRowDeleteConfirm({
  rows: () => props.habits,
  find,
  remove: habit => window.bulletin.habits.archive(habit.id),
  deleted: habit => emit('archived', habit),
  failure: 'Couldn’t delete the Habit. Try again.',
  // With no Habit left, the new-habit row.
  refocus: habit => focusRow(habit
    ? props.habits.indexOf(habit)
    : props.habits.length),
  asking: computed({
    get: () => active.value?.mode === 'delete'
      && active.value.id !== 'new'
      ? active.value.id
      : null,
    set: id => {
      active.value = id === null
        ? null
        : { mode: 'delete', id }
    }
  }),
  busy
})

const openEditor = (index: number): void => {
  if (busy.value) return
  focused.value = index
  active.value = {
    mode: 'edit',
    id: props.habits.at(index)?.id ?? 'new'
  }
  error.value = null
}

const askDelete = async (index: number): Promise<void> => {
  if (busy.value) return
  focused.value = index
  await ask(props.habits[index].id)
}

/** Closes the editor, refocusing its row. */
const closeEditor = async (): Promise<void> => {
  if (busy.value || active.value === null) return
  const { id } = active.value
  active.value = null
  error.value = null
  await nextTick()
  const index = props.habits
    .findIndex(habit => habit.id === id)
  focusRow(index < 0 ? props.habits.length : index)
}

const onUpdated = async (habit: Habit): Promise<void> => {
  emit('updated', habit)
  await closeEditor()
}

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
          @cancel="closeEditor"
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
            @click="archive(habit)"
          >
            <Icon name="check" />
          </button>
          <button
            class="control"
            type="button"
            aria-label="Don’t delete"
            :disabled="busy"
            @click="cancelDelete(true)"
          >
            <Icon name="close" />
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
            @click="openEditor(i)"
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
            <Icon name="minus" />
          </button>
          <Icon
            v-if="habit.id === current"
            class="current"
            name="check"
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
          @cancel="closeEditor"
        />
        <button
          v-else
          class="choose"
          type="button"
          :tabindex="habits.length === focused ? 0 : -1"
          @click="openEditor(habits.length)"
          @focus="focused = habits.length"
        >
          <Icon class="add" name="plus-small" />
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

  // Lucide's pencil, the one icon Figma doesn't draw.
  .icon {
    width: rem(16px);
    height: rem(16px);
  }

  .controls > .current { margin: 0 rem(3px); }

  .row.-new > .choose > .add { grid-row: auto; }

  > .error {
    margin-top: space(1);
    font-size: rem(11px);
    color: var(--color-text);
  }
}
</style>
