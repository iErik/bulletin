<script setup lang="ts">
// The date header's popover: day, month and year
// dropdowns that set the Selected Date. They never
// offer a future day, and the day list follows the
// chosen month's length.
import { computed } from 'vue'
import { getDaysInMonth } from 'date-fns'
import { formatDate } from '@/locale/format'
import { useSelectedDateStore }
  from '@/stores/selected-date'

/** How many years back the year list reaches. */
const YEARS_BACK = 20

const store = useSelectedDateStore()

const year = computed(() => store.day.getFullYear())
const month = computed(() => store.day.getMonth())
const date = computed(() => store.day.getDate())

const range = (from: number, to: number): number[] =>
  Array.from(
    { length: to - from + 1 },
    (_, i) => from + i
  )

// Newest first, reaching back far enough to include
// the Selected Date's year.
const years = computed(() => {
  const latest = store.today.getFullYear()
  const earliest = Math.min(
    latest - YEARS_BACK + 1,
    year.value
  )
  return range(earliest, latest).reverse()
})

const isThisYear = computed(() =>
  year.value === store.today.getFullYear()
)

const months = computed(() =>
  range(
    0,
    isThisYear.value ? store.today.getMonth() : 11
  ).map(value => ({
    value,
    name: formatDate(new Date(2000, value, 1), 'month')
  }))
)

const days = computed(() => {
  const isThisMonth = isThisYear.value
    && month.value === store.today.getMonth()
  return range(
    1,
    isThisMonth
      ? store.today.getDate()
      : getDaysInMonth(store.day)
  )
})

/**
 * Selects the given parts, keeping the others. The day
 * is clamped to the month's length here, and to today
 * by the store.
 */
const select = (parts: {
  year?: number
  month?: number
  date?: number
}): void => {
  const y = parts.year ?? year.value
  const m = parts.month ?? month.value
  const length = getDaysInMonth(new Date(y, m, 1))
  const d = Math.min(parts.date ?? date.value, length)
  store.setDay(new Date(y, m, d))
}

const valueOf = (event: Event): number =>
  Number((event.target as HTMLSelectElement).value)
</script>

<template>
  <div
    class="date-picker no-drag"
    role="dialog"
    aria-label="Choose a date"
  >
    <select
      class="field"
      aria-label="Day"
      :value="date"
      @change="select({ date: valueOf($event) })"
    >
      <option v-for="d in days" :key="d" :value="d">
        {{ String(d).padStart(2, '0') }}
      </option>
    </select>
    <select
      class="field"
      aria-label="Month"
      :value="month"
      @change="select({ month: valueOf($event) })"
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
      @change="select({ year: valueOf($event) })"
    >
      <option v-for="y in years" :key="y" :value="y">
        {{ y }}
      </option>
    </select>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// A raised strip of dropdowns, as in Figma.
.date-picker {
  display: flex;
  gap: space(1);
  padding: space(1);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: $radius-medium;
  @include colour-transition;

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
