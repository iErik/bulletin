<script setup lang="ts">
// Habit effects (Figma 3889:9527): four cross-tracker
// rows in fixed order (Sleep, Mood, Expenses, Calendar),
// each showing the qualifying Habit with the largest
// effect from `@/habits/effects`; empty rows are hidden.
import { computed, ref, shallowRef, watch } from 'vue'
import { localDate } from '@shared/dates'
import type { Transaction } from '@shared/expenses'
import type { Habit, HabitEntry } from '@shared/habits'
import type { MoodEntry } from '@shared/mood'
import type { SleepPeriod } from '@shared/sleep'
import type { LocalDate } from '@shared/storage'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import {
  calendarEffect,
  expensesEffect,
  moodEffect,
  sleepEffect,
  type EffectRow
} from '@/habits/effects'
import { shiftDay } from '@/habits/rules'
import type { EffectTone } from '@/mood/mood-effect'
import { last90Range } from '@/mood/overview'
import { sleepFetchRange } from '@/sleep/stretches'
import { useSelectedDateStore }
  from '@/stores/selected-date'

interface Data {
  /** The Selected Date this snapshot was loaded for. */
  readonly date: LocalDate
  readonly habits: Habit[]
  readonly entries: HabitEntry[]
  readonly periods: SleepPeriod[]
  readonly moods: MoodEntry[]
  readonly transactions: Transaction[]
}

const selected = useSelectedDateStore()
const version = useDataVersion(
  'habits', 'habitEntries', 'sleep', 'mood', 'transactions'
)
const data = shallowRef<Data | null>(null)
const failed = ref(false)
// Bumped by each load, so a load it overtook is dropped.
let generation = 0

const date = computed(() => localDate(selected.day))

const load = async (): Promise<void> => {
  const asked = ++generation
  const day = date.value
  const { habits, sleep, mood, expenses } = window.bulletin
  const range = last90Range(day)
  const sleepRange = sleepFetchRange({
    from: shiftDay(range.from, 1),
    to: day
  })
  const [
    habitList, entries, periods, moods, transactions
  ] = await Promise.all([
    habits.list('all'),
    habits.listEntries({ from: '1970-01-01', to: day }),
    sleep.list(sleepRange),
    mood.list(range),
    expenses.list(range)
  ])
  if (asked !== generation) return
  if (
    !habitList.ok || !entries.ok || !periods.ok
    || !moods.ok || !transactions.ok
  ) {
    failed.value = true
    data.value = null
    return
  }
  failed.value = false
  data.value = {
    date: day,
    habits: habitList.value,
    entries: entries.value,
    periods: periods.value,
    moods: moods.value,
    transactions: transactions.value
  }
}

watch(
  () => [date.value, version.value] as const,
  () => { void load() },
  { immediate: true }
)

interface Row {
  readonly label: string
  readonly tracker: string
  readonly value: string
  readonly tone: EffectTone
}

const rowOf = (
  label: string,
  tracker: string,
  found: EffectRow
): Row => ({
  label,
  tracker,
  value: found.value,
  tone: found.tone
})

const rows = computed((): Row[] => {
  const d = data.value
  if (!d) return []
  const sleepFound = sleepEffect(
    d.habits, d.entries, d.periods, d.date
  )
  const moodFound = moodEffect(
    d.habits, d.entries, d.moods, d.date
  )
  const spendFound = expensesEffect(
    d.habits, d.entries, d.transactions, d.date
  )
  const calendarFound = calendarEffect(
    d.habits, d.entries, d.date
  )
  return [
    sleepFound && rowOf(
      `${sleepFound.habit.name} days`, 'Sleep', sleepFound
    ),
    moodFound && rowOf(
      `${moodFound.habit.name} days`, 'Mood', moodFound
    ),
    spendFound && rowOf(
      `${spendFound.habit.name} days`,
      'Expenses',
      spendFound
    ),
    calendarFound && rowOf(
      `${calendarFound.habit.name} streaks end on`,
      'Calendar',
      calendarFound
    )
  ].filter(row => row !== null)
})
</script>

<template>
  <Widget
    class="habit-effects"
    title="Habit effects"
    icon="activity"
  >
    <template #actions>
      <p class="subtitle">
        Cross-tracker
      </p>
    </template>
    <p v-if="failed" class="error" role="alert">
      Couldn’t load Habit effects.
    </p>
    <ul v-else class="rows">
      <li
        v-for="row in rows"
        :key="row.tracker"
        class="row"
        :data-tone="row.tone"
      >
        <span class="dot" aria-hidden="true" />
        <span class="label" :title="row.label">
          {{ row.label }}
        </span>
        <span class="tracker">{{ row.tracker }}</span>
        <span class="value">{{ row.value }}</span>
      </li>
    </ul>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.habit-effects {
  --widget-gap: #{rem(8px)};

  > .header > .actions > .subtitle {
    margin: 0 rem(4px) 0 0;
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--color-widget-title);
  }
}

.habit-effects > .body > .error {
  font-size: rem(11px);
  color: var(--color-text-muted);
}

.habit-effects .rows {
  display: flex;
  flex-direction: column;
  gap: rem(6px);
  margin: 0;
  padding: 0;
  list-style: none;
}

// Colours follow the BLT-118 brief and its Good/Hard
// amendment: green for good, red for bad, grey for
// Neutral.
.habit-effects .row {
  --tone: var(--color-mood-neutral);

  display: grid;
  grid-template-columns:
    rem(6px) rem(176px) minmax(0, 1fr) auto;
  gap: rem(8px);
  align-items: center;
  min-height: rem(32px);
  padding: 0 rem(12px);
  background: color-mix(
    in sRGB, var(--color-text) 3%, transparent
  );
  border-radius: rem(5px);

  &[data-tone='good'] { --tone: var(--color-improvement); }
  &[data-tone='bad'] { --tone: var(--color-worsening); }

  > .dot {
    width: rem(6px);
    height: rem(6px);
    background: var(--tone);
    border-radius: 50%;
  }

  > .label,
  > .tracker {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > .label {
    font-size: rem(12px);
    font-weight: 500;
    color: var(--color-habit-board-name);
  }

  > .tracker {
    font-size: rem(9px);
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
