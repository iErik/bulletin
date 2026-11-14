<script setup lang="ts">
// The Month Grid (see `CONTEXT.md`): one month's Day
// Pills in weeks starting on the Locale's first day.
// The using Widget decides each Day Pill's colours and
// label, and what activating it does; the grid owns
// the layout, the states, the tooltip and the
// keyboard. Days after today, and any the Widget
// disables, are dimmed and inert; the Selected Date's
// Day Pill is outlined. A filled Day Pill is Figma's
// "Mood Indicator": a blurred base under a glowing
// inner pill; an empty one is the base alone.
import { computed, nextTick, ref, watch } from 'vue'
import { isAfter, isSameDay, isSameMonth } from 'date-fns'
import { monthWeeks, weekdays } from '@/month-grid/layout'
import { firstDayOfWeek, formatDate } from '@/locale/format'
import type { PillColours } from '@/theme/types'
import { useSelectedDateStore }
  from '@/stores/selected-date'

const props = defineProps<{
  /** Any day in the month to show. */
  month: Date
  /** What the tooltip says after the date. */
  label: (day: Date) => string
  /** A filled Day Pill's colours; none when empty. */
  pill?: (day: Date) => PillColours | undefined
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

/** The enabled days' days of the month, in order. */
const activeDays = computed(() =>
  weeks.value.flat()
    .filter((day): day is Date =>
      day !== null && !isDisabled(day))
    .map(day => day.getDate()))

// Roving tabindex: the one Day Pill in the Tab order,
// by day of the month.
const focused = ref(1)

watch(
  [() => store.day, () => props.month, activeDays],
  () => {
    const start = isSameMonth(store.day, props.month)
      ? store.day.getDate()
      : 1
    // The enabled day at or before it, else the first.
    const days = activeDays.value
    focused.value = days.findLast(d => d <= start)
      ?? days[0]
      ?? 1
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
    if (activeDays.value.includes(target)) {
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
  const colours = props.pill?.(day)
  return colours
    ? Object.fromEntries(Object.entries(colours).map(
        ([part, colour]) => [`--pill-${part}`, colour]))
    : {}
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
            '-filled': pill?.(day) !== undefined,
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
        >
          <span class="base" />
          <span v-if="pill?.(day)" class="glow" />
        </button>
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

@function glow($colour, $alpha) {
  @return color-mix(in sRGB, #{$colour} $alpha, transparent);
}

// Seven columns; the weekday headers, then one 12px
// row per week, as Figma's frames place them.
.month-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: auto repeat(var(--weeks), rem(12px));
  gap: rem(7px) rem(8px);
  align-content: start;
  height: 100%;
  padding: 0 rem(4px);

  // Figma's first week is 19px below the weekdays.
  > .weekday {
    margin-bottom: rem(12px);
    font-size: rem(11px);
    line-height: rem(13px);
    font-weight: 700;
    text-align: center;
    color: var(--color-weekday);
  }

  > .pill {
    position: relative;
    align-self: center;
    height: rem(12px);
    border-radius: rem(4px);
    @include colour-transition(opacity);
    @include focus-ring;
  }

  > .pill > .base {
    position: absolute;
    inset: 0;
    background: var(--pill-base, var(--color-pill-empty));
    filter: blur(1.5px);
    border-radius: rem(4px);
    @include colour-transition(background-color);
  }

  > .pill > .glow {
    position: absolute;
    inset: 25% 7.5%;
    background: var(--pill-glow);
    filter: blur(1.75px);
    border-radius: rem(6px);
    box-shadow:
      0 0 17.5px glow(var(--pill-shadow), 38%),
      0 2px 5px glow(var(--pill-tint), 35%),
      0 0 9.2px glow(var(--pill-shadow), 82%),
      0 0 13.4px 7px glow(var(--pill-shadow), 12%);
  }

  > .pill.-selected {
    // DISABLED
    // outline: 1px solid var(--color-text);
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
