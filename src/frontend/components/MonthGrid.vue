<script setup lang="ts">
// The Month Grid (see `CONTEXT.md`): one month's Day
// Pills in weeks starting on the Locale's first day.
// The using Widget decides each Day Pill's colour and
// label, and what activating it does; the grid owns
// the layout, the states, the tooltip and the
// keyboard. Days after today, and any the Widget
// disables, are dimmed and inert; the Selected Date's
// Day Pill is outlined.
import { computed, nextTick, ref, watch } from 'vue'
import { isAfter, isSameDay, isSameMonth } from 'date-fns'
import { monthWeeks, weekdays } from '@/month-grid/layout'
import { firstDayOfWeek, formatDate } from '@/locale/format'
import { useSelectedDateStore }
  from '@/stores/selected-date'

const props = defineProps<{
  /** Any day in the month to show. */
  month: Date
  /** What the tooltip says after the date. */
  label: (day: Date) => string
  /** A CSS colour, or none for the placeholder. */
  colour?: (day: Date) => string | undefined
  /** Days to dim and ignore, besides future ones. */
  disabled?: (day: Date) => boolean
}>()

const emit = defineEmits<{ activate: [day: Date] }>()

const store = useSelectedDateStore()

const weekStart = computed(() => firstDayOfWeek())

const weeks = computed(() =>
  monthWeeks(props.month, weekStart.value))

const headers = computed(() =>
  weekdays(weekStart.value).map(day =>
    formatDate(day, 'weekday').toLocaleUpperCase()))

const isFuture = (day: Date): boolean =>
  isAfter(day, store.today)

const isDisabled = (day: Date): boolean =>
  isFuture(day) || (props.disabled?.(day) ?? false)

/** Last non-future day's day of month, or 0. */
const lastActiveDay = computed(() => {
  const days = weeks.value.flat()
    .filter((day): day is Date =>
      day !== null && !isFuture(day))
  return days.at(-1)?.getDate() ?? 0
})

// Roving tabindex: the one Day Pill in the Tab order,
// by day of the month.
const focused = ref(1)

watch(
  [() => store.day, () => props.month],
  () => {
    const start = isSameMonth(store.day, props.month)
      ? store.day.getDate()
      : 1
    focused.value = Math.max(
      1,
      Math.min(start, lastActiveDay.value)
    )
  },
  { immediate: true }
)

const pills = new Map<number, HTMLButtonElement>()

const register = (day: Date, el: unknown): void => {
  if (el instanceof HTMLButtonElement)
    pills.set(day.getDate(), el)
  else pills.delete(day.getDate())
}

/** Moves keyboard focus to `day`'s Day Pill. */
const focusDay = async (day: Date): Promise<void> => {
  focused.value = day.getDate()
  await nextTick()
  pills.get(focused.value)?.focus()
}

defineExpose({ focusDay })

const STEPS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7
}

const activate = (day: Date): void => {
  if (isDisabled(day)) return
  focused.value = day.getDate()
  emit('activate', day)
}

const onKeydown = (
  event: KeyboardEvent,
  day: Date
): void => {
  const step = STEPS[event.key]
  if (step !== undefined) {
    const target = day.getDate() + step
    if (target >= 1 && target <= lastActiveDay.value) {
      focused.value = target
      pills.get(target)?.focus()
    }
  } else if (event.key === 'Enter' || event.key === ' ')
    activate(day)
  else return
  event.preventDefault()
  // Keeps the date header's ← → shortcuts out of it.
  event.stopPropagation()
}

const describe = (day: Date): string =>
  `${formatDate(day, 'short')} · ${props.label(day)}`

// The tooltip follows the pointer, else keyboard focus.
const hovered = ref<Date | null>(null)
const focusedPill = ref<Date | null>(null)

const tooltip = computed(() => {
  const day = hovered.value ?? focusedPill.value
  const el = day && pills.get(day.getDate())
  if (!day || !el) return null
  return {
    text: describe(day),
    style: {
      left: `${el.offsetLeft + el.offsetWidth / 2}px`,
      top: `${el.offsetTop}px`
    }
  }
})

const pillStyle = (
  day: Date
): Record<string, string> => {
  const colour = props.colour?.(day)
  return colour ? { '--pill-colour': colour } : {}
}
</script>

<template>
  <div
    class="month-grid"
    role="group"
    :aria-label="formatDate(month, 'month')"
    :style="{ '--weeks': weeks.length }"
  >
    <span
      v-for="name in headers"
      :key="name"
      class="weekday"
      aria-hidden="true"
    >
      {{ name }}
    </span>
    <template v-for="(week, w) in weeks" :key="w">
      <template v-for="(day, d) in week" :key="d">
        <span v-if="!day" class="slot" />
        <button
          v-else
          :ref="el => register(day, el)"
          class="pill"
          :class="{
            '-filled': colour?.(day) !== undefined,
            '-selected': isSameDay(day, store.day),
            '-disabled': isDisabled(day)
          }"
          type="button"
          :style="pillStyle(day)"
          :aria-label="describe(day)"
          :aria-disabled="isDisabled(day) || undefined"
          :tabindex="day.getDate() === focused ? 0 : -1"
          @click="activate(day)"
          @keydown="onKeydown($event, day)"
          @pointerenter="hovered = day"
          @pointerleave="hovered = null"
          @focus="focusedPill = day"
          @blur="focusedPill = null"
        />
      </template>
    </template>
    <span
      v-if="tooltip"
      class="tooltip"
      :style="tooltip.style"
      aria-hidden="true"
    >
      {{ tooltip.text }}
    </span>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Seven columns; the weekday headers, then one row per
// week, whose Day Pills share the remaining height.
.month-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows:
    auto repeat(var(--weeks), minmax(0, 1fr));
  gap: rem(7px) rem(8px);
  height: 100%;

  > .weekday {
    padding-bottom: space(1);
    font-size: rem(11px);
    font-weight: 700;
    text-align: center;
    color: var(--color-text-muted);
  }

  // The placeholder, or the using Widget's colour. A
  // Widget adds any further styling, such as a glow.
  > .pill {
    align-self: center;
    height: 100%;
    max-height: rem(14px);
    min-height: rem(6px);
    background: var(--color-border);
    border-radius: $radius-small;
    @include colour-transition(
      background-color,
      opacity
    );
    @include focus-ring;
  }

  > .pill.-filled {
    background: var(--pill-colour);
  }

  > .pill.-selected {
    outline: 1px solid var(--color-text);
    outline-offset: 2px;
  }

  > .pill.-disabled {
    cursor: default;
    opacity: 0.35;
  }

  > .tooltip {
    position: absolute;
    z-index: 1;
    padding: space(1) space(2);
    font-size: rem(11px);
    white-space: nowrap;
    color: var(--color-text);
    pointer-events: none;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: $radius-small;
    transform: translate(-50%, calc(-100% - #{space(1)}));
  }
}
</style>
