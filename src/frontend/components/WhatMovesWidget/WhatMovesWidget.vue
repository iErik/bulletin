<script setup lang="ts">
// What moves your mood (Figma 3889:7617): one row per
// condition, in a fixed order, each with the Mood that
// changes most when it holds. The rows come from
// `@/mood/what-moves`; a row it leaves out is hidden.
import { computed, ref, shallowRef, watch } from 'vue'
import { format, parseISO } from 'date-fns'
import { localDate } from '@shared/dates'
import type {
  Budget,
  LocalMonth,
  Transaction
} from '@shared/expenses'
import type { Habit, HabitEntry } from '@shared/habits'
import type { MoodEntry } from '@shared/mood'
import type { SleepPeriod } from '@shared/sleep'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import type { EffectTone } from '@/mood/mood-effect'
import { last90Range } from '@/mood/overview'
import {
  calendarRow,
  expensesRow,
  habitsRow,
  sleepRow,
  type MoodRow
} from '@/mood/what-moves'
import { sleepFetchRange } from '@/sleep/stretches'
import { useSelectedDateStore }
  from '@/stores/selected-date'

interface Data {
  readonly moods: MoodEntry[]
  readonly periods: SleepPeriod[]
  readonly goal: number
  readonly habits: Habit[]
  readonly entries: HabitEntry[]
  readonly transactions: Transaction[]
  readonly budgets: Map<LocalMonth, Budget | null>
}

const selected = useSelectedDateStore()
const version = useDataVersion(
  'mood', 'sleep', 'sleepGoal', 'habits', 'habitEntries',
  'transactions', 'budget'
)
const data = shallowRef<Data | null>(null)
const failed = ref(false)
// Bumped by each load, so a load it overtook is dropped.
let generation = 0

const date = computed(() => localDate(selected.day))

/** Each month the range touches, as `YYYY-MM`. */
const monthsOf = (from: string, to: string): LocalMonth[] => {
  const months: LocalMonth[] = []
  const day = parseISO(`${from.slice(0, 7)}-01`)
  while (format(day, 'yyyy-MM') <= to.slice(0, 7)) {
    months.push(format(day, 'yyyy-MM'))
    day.setMonth(day.getMonth() + 1)
  }
  return months
}

const load = async (): Promise<void> => {
  const asked = ++generation
  const { mood, sleep, habits, expenses } = window.bulletin
  const range = last90Range(date.value)
  const months = monthsOf(range.from, range.to)
  const [
    moods, periods, goal, habitList, entries, spent,
    ...budgets
  ] = await Promise.all([
    mood.list(range),
    sleep.list(sleepFetchRange(range)),
    sleep.getGoal(),
    habits.list('all'),
    habits.listEntries(range),
    // Running month totals start on the 1st.
    expenses.list({ from: `${months[0]}-01`, to: range.to }),
    ...months.map(month => expenses.getBudget(month))
  ])
  if (asked !== generation) return
  if (
    !moods.ok || !periods.ok || !goal.ok || !habitList.ok
    || !entries.ok || !spent.ok || budgets.some(b => !b.ok)
  ) {
    failed.value = true
    data.value = null
    return
  }
  failed.value = false
  data.value = {
    moods: moods.value,
    periods: periods.value,
    goal: goal.value,
    habits: habitList.value,
    entries: entries.value,
    transactions: spent.value,
    budgets: new Map(months.map((month, i) => {
      const got = budgets[i]
      return [month, got.ok ? got.value : null]
    }))
  }
}

watch(
  () => [date.value, version.value] as const,
  () => { void load() },
  { immediate: true }
)

/** A Sleep Goal as "7h" or "7h 30m". */
const hours = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

interface Row {
  readonly name: string
  readonly tracker: string
  readonly value: string
  readonly tone: EffectTone
}

const rowOf = (
  name: string,
  tracker: string,
  found: MoodRow
): Row => ({
  name,
  tracker,
  value: found.value,
  tone: found.effect.tone
})

const rows = computed((): Row[] => {
  const d = data.value
  if (!d) return []
  const day = date.value
  const sleepFound = sleepRow(d.moods, d.periods, d.goal, day)
  const habitFound = habitsRow(d.moods, d.habits, d.entries, day)
  const spendFound = expensesRow(
    d.moods, d.transactions, d.budgets, day
  )
  const weekendFound = calendarRow(d.moods, day)
  return [
    sleepFound && rowOf(
      `Slept ${hours(sleepFound.goalMinutes)} or more`,
      'Sleep',
      sleepFound
    ),
    habitFound && rowOf(habitFound.habit.name, 'Habits', habitFound),
    spendFound && rowOf('Over budget pace', 'Expenses', spendFound),
    weekendFound && rowOf('Weekends', 'Calendar', weekendFound)
  ].filter(row => row !== null)
})
</script>

<template>
  <Widget
    class="what-moves"
    title="What moves your mood"
    icon="activity"
  >
    <template #actions>
      <p class="subtitle">
        Cross-tracker
      </p>
    </template>
    <p v-if="failed" class="error" role="alert">
      Couldn’t load What moves your mood.
    </p>
    <ul v-else class="rows">
      <li
        v-for="row in rows"
        :key="row.tracker"
        class="row"
        :data-tone="row.tone"
      >
        <span class="dot" aria-hidden="true" />
        <span class="name">{{ row.name }}</span>
        <span class="tracker">{{ row.tracker }}</span>
        <span class="value">{{ row.value }}</span>
      </li>
    </ul>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.what-moves {
  --widget-gap: #{rem(8px)};

  > .header > .actions > .subtitle {
    margin: 0;
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-widget-title);
  }
}

.what-moves > .body > .error {
  font-size: rem(11px);
  color: var(--color-text-muted);
}

.what-moves .rows {
  display: flex;
  flex-direction: column;
  gap: rem(4px);
  margin: 0;
  padding: 0;
  list-style: none;
}

// The brief's colours, not each Mood's: Figma's green
// (Happy's swatch), the danger red, and Neutral's grey.
.what-moves .row {
  --tone: var(--color-mood-neutral);

  display: grid;
  grid-template-columns:
    rem(6px) rem(166px) minmax(0, 1fr) auto;
  gap: rem(8px);
  align-items: center;
  min-height: rem(34px);
  padding: 0 rem(13px) 0 rem(12px);
  background: color-mix(
    in sRGB, var(--color-text) 3%, transparent
  );
  border-radius: rem(5px);

  &[data-tone='good'] { --tone: var(--color-mood-happy); }
  &[data-tone='bad'] { --tone: var(--color-danger); }

  > .dot {
    width: rem(6px);
    height: rem(6px);
    background: var(--tone);
    border-radius: 50%;
  }

  > .name,
  > .tracker {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > .name {
    font-size: rem(12px);
    font-weight: 500;
    color: var(--color-text);
  }

  > .tracker {
    font-size: rem(10px);
    font-weight: 700;
    text-transform: uppercase;
    color: color-mix(
      in sRGB, var(--color-tile-icon) 50%, transparent
    );
  }

  > .value {
    font-family: $font-family-mono;
    font-size: rem(11px);
    font-weight: 500;
    white-space: nowrap;
    color: var(--tone);
  }
}
</style>
