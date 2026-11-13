<script setup lang="ts">
// Day, month and year dropdowns for one day, as a
// `v-model`: the date header's popover and the Weight
// form's date. They never offer or emit a day after
// `max`, and the day list follows the chosen month's
// length.
import { computed } from 'vue'
import { getDaysInMonth, isAfter } from 'date-fns'
import { formatDate, formatNumber } from '@/locale/format'

/** How many years back the year list reaches. */
const YEARS_BACK = 20

const props = defineProps<{
  /** The chosen day, at local midnight. */
  modelValue: Date
  /** The latest day offered: today. */
  max: Date
}>()

const emit = defineEmits<{
  'update:modelValue': [day: Date]
}>()

const day = computed(() => props.modelValue)
const year = computed(() => day.value.getFullYear())
const month = computed(() => day.value.getMonth())
const dayOfMonth = computed(() => day.value.getDate())

const range = (from: number, to: number): number[] =>
  Array.from(
    { length: to - from + 1 },
    (_, i) => from + i
  )

// Newest first, reaching back far enough to include
// the chosen year.
const years = computed(() => {
  const latest = props.max.getFullYear()
  const earliest = Math.min(
    latest - YEARS_BACK + 1,
    year.value
  )
  return range(earliest, latest).reverse()
})

const isMaxYear = computed(() =>
  year.value === props.max.getFullYear()
)

const months = computed(() =>
  range(
    0,
    isMaxYear.value ? props.max.getMonth() : 11
  ).map(value => ({
    value,
    name: formatDate(new Date(2000, value, 1), 'month')
  }))
)

const days = computed(() => {
  const isMaxMonth = isMaxYear.value
    && month.value === props.max.getMonth()
  return range(
    1,
    isMaxMonth
      ? props.max.getDate()
      : getDaysInMonth(day.value)
  )
})

// Sets one part, keeping the others. The day is clamped
// to the month's length, then to `max`.
const select = (
  part: 'day' | 'month' | 'year',
  event: Event
): void => {
  const { value } = event.target as HTMLSelectElement
  const parts = {
    year: year.value,
    month: month.value,
    day: dayOfMonth.value,
    [part]: Number(value)
  }
  const length = getDaysInMonth(
    new Date(parts.year, parts.month, 1)
  )
  const chosen = new Date(
    parts.year, parts.month, Math.min(parts.day, length)
  )
  emit(
    'update:modelValue',
    isAfter(chosen, props.max) ? props.max : chosen
  )
}
</script>

<template>
  <div class="date-picker">
    <select
      class="field"
      aria-label="Day"
      :value="dayOfMonth"
      @change="select('day', $event)"
    >
      <option v-for="d in days" :key="d" :value="d">
        {{ formatNumber(d, { minimumIntegerDigits: 2 }) }}
      </option>
    </select>
    <select
      class="field"
      aria-label="Month"
      :value="month"
      @change="select('month', $event)"
    >
      <option
        v-for="m in months"
        :key="m.value"
        :value="m.value"
      >
        {{ m.name }}
      </option>
    </select>
    <select
      class="field"
      aria-label="Year"
      :value="year"
      @change="select('year', $event)"
    >
      <option v-for="y in years" :key="y" :value="y">
        {{ formatNumber(y, { useGrouping: false }) }}
      </option>
    </select>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// A strip of dropdowns, as in Figma.
.date-picker {
  display: flex;
  gap: space(1);

  > .field {
    padding: space(1) space(2);
    font-size: rem(12px);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid transparent;
    border-radius: $radius-small;
    @include focus-ring;
  }
}
</style>
