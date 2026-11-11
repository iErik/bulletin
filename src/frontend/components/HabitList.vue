<script setup lang="ts">
// The Habits Widget's Habit list: a row per active
// Habit with its icon, name and "N / D days", and ✓ on
// the current one. Clicking a row, or Enter on it,
// emits `choose`. ↑ ↓ Home End move between rows.
import { onMounted, ref, useTemplateRef } from 'vue'
import { Check } from '@lucide/vue'
import type { Habit } from '@shared/habits'
import { HABIT_ICON_COMPONENTS } from '@/habits/icons'
import { formatNumber } from '@/locale/format'

const props = defineProps<{
  /** The active Habits, oldest first. */
  habits: readonly Habit[]
  /** The current Habit's id. */
  current: number
  /** A Habit's done days in the month. */
  done: (habit: Habit) => number
  /** The number of days in the month. */
  days: number
}>()

const emit = defineEmits<{
  choose: [habit: Habit]
}>()

const count = (habit: Habit): string =>
  `${formatNumber(props.done(habit))} / `
  + `${formatNumber(props.days)} days`

const root = useTemplateRef<HTMLElement>('root')

/** The first element in DOM order matching `selector`. */
const find = (selector: string): HTMLElement | null =>
  root.value?.querySelector(selector) ?? null

// Roving tabindex over the rows.
const focused = ref(Math.max(0, props.habits
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
  focusRow(target(index, props.habits.length - 1))
}

onMounted(() => {
  focusRow(focused.value)
})
</script>

<template>
  <div ref="root" class="habit-list">
    <ul class="rows" aria-label="Habits">
      <li
        v-for="(habit, i) in habits"
        :key="habit.id"
        class="row"
        :class="{ '-current': habit.id === current }"
        @keydown="onRowKeydown($event, i)"
      >
        <button
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
        <Check
          v-if="habit.id === current"
          class="icon -check"
          aria-hidden="true"
        />
      </li>
    </ul>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma's "Habit Selection": tinted rows, the current
// one fainter with ✓ on the right.
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

  .icon {
    width: rem(16px);
    height: rem(16px);
  }
}
</style>
