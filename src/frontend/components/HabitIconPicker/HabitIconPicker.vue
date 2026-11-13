<script setup lang="ts">
// The Habit icon picker: a button showing the chosen
// icon that opens a grid of every Habit icon below it.
// The grid is a radio group: the arrow keys, Home and
// End move, and Enter, Space or a click chooses and
// closes it. Escape closes the grid alone.
import { nextTick, ref, useTemplateRef } from 'vue'
import { HABIT_ICONS, type HabitIcon } from '@shared/habits'
import { HABIT_ICON_COMPONENTS } from '@/habits/icons'

const model = defineModel<HabitIcon>({ required: true })

const COLUMNS = 8

const open = ref(false)
const focused = ref(0)
const root = useTemplateRef<HTMLElement>('root')

const label = (icon: HabitIcon): string =>
  icon.replace('-', ' ')

const focusIcon = (index: number): void => {
  focused.value = index
  root.value?.querySelectorAll<HTMLElement>('.option')
    [index]?.focus()
}

const focusToggle = (): void => {
  root.value?.querySelector<HTMLElement>('.toggle')
    ?.focus()
}

const toggle = async (): Promise<void> => {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  focusIcon(HABIT_ICONS.indexOf(model.value))
}

const pick = (icon: HabitIcon): void => {
  model.value = icon
  open.value = false
  focusToggle()
}

const last = HABIT_ICONS.length - 1

const TARGETS: Readonly<Record<
  string,
  (index: number) => number
>> = {
  ArrowLeft: i => Math.max(0, i - 1),
  ArrowRight: i => Math.min(last, i + 1),
  ArrowUp: i => i < COLUMNS ? i : i - COLUMNS,
  ArrowDown: i => i + COLUMNS > last ? i : i + COLUMNS,
  Home: () => 0,
  End: () => last
}

const onKeydown = (event: KeyboardEvent): void => {
  const target = TARGETS[event.key]
  if (!target && event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  if (target) {
    focusIcon(target(focused.value))
    return
  }
  open.value = false
  focusToggle()
}
</script>

<template>
  <div ref="root" class="habit-icon-picker">
    <button
      class="toggle"
      type="button"
      :aria-label="`Icon: ${label(model)}`"
      :aria-expanded="open"
      @click="toggle"
    >
      <component
        :is="HABIT_ICON_COMPONENTS[model]"
        class="icon"
        aria-hidden="true"
      />
    </button>
    <div
      v-if="open"
      class="grid"
      role="radiogroup"
      aria-label="Icon"
      :style="{ '--columns': COLUMNS }"
      @keydown="onKeydown"
    >
      <button
        v-for="(icon, i) in HABIT_ICONS"
        :key="icon"
        class="option"
        :class="{ '-chosen': icon === model }"
        type="button"
        role="radio"
        :aria-label="label(icon)"
        :aria-checked="icon === model"
        :tabindex="i === focused ? 0 : -1"
        @click="pick(icon)"
        @focus="focused = i"
      >
        <component
          :is="HABIT_ICON_COMPONENTS[icon]"
          class="icon"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Its toggle and grid take part in the editor's grid.
// The grid has row 2 to itself: items with a definite
// row are placed first, and the rest then fill row 1.
.habit-icon-picker {
  $tint: color-mix(
    in sRGB,
    var(--color-text) 8%,
    transparent
  );

  display: contents;

  > .toggle,
  > .grid > .option {
    display: grid;
    place-items: center;
    width: rem(26px);
    height: rem(26px);
    color: var(--color-text-muted);
    border-radius: rem(6px);
    @include colour-transition;
    @include focus-ring;

    &:hover { background: $tint; }
  }

  > .toggle { background: $tint; }

  > .grid {
    display: grid;
    grid-row: 2;
    grid-column: 1 / -1;
    grid-template-columns: repeat(var(--columns), 1fr);
    gap: rem(2px);
    justify-items: center;
  }

  > .grid > .option.-chosen {
    color: var(--color-text);
    background: $tint;
  }

  .icon {
    width: rem(14px);
    height: rem(14px);
  }
}
</style>
