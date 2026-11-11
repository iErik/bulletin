<script setup lang="ts">
// The Habits Widget: the current Habit's days in the
// Selected Date's month, on a Month Grid. Done Day
// Pills glow; days before the Habit was created are
// disabled. Activating a Day Pill toggles it and saves
// at once; if storage fails, it reverts and an inline
// error shows. The current Habit is remembered per
// device, falling back to the oldest active Habit.
import { computed, ref, shallowRef, watch } from 'vue'
import { endOfMonth, startOfMonth } from 'date-fns'
import type { Habit, HabitEntry } from '@shared/habits'
import { localDate } from '@shared/dates'
import MonthGrid from '@/components/MonthGrid.vue'
import Widget from '@/components/Widget.vue'
import {
  pickCurrentHabit,
  readCurrentHabit,
  writeCurrentHabit
} from '@/habits/current-habit'
import { useSelectedDateStore }
  from '@/stores/selected-date'

const store = useSelectedDateStore()

/** The first of the Selected Date's month. */
const month = computed(() => startOfMonth(store.day))

/** The active Habits, oldest first; null till loaded. */
const habits = shallowRef<Habit[] | null>(null)
const remembered = readCurrentHabit()
const current = computed(() =>
  pickCurrentHabit(habits.value ?? [], remembered))

watch(current, habit => {
  if (habit) writeCurrentHabit(habit.id)
})

const entryKey = (entry: HabitEntry): string =>
  `${entry.habitId} ${entry.date}`

/** The month's Habit Entries, by `entryKey`. */
const done = shallowRef(new Set<string>())
const failed = ref(false)
const error = ref<string | null>(null)

const loadHabits = async (): Promise<void> => {
  const result = await window.bulletin.habits
    .list('active')
  if (result.ok) habits.value = result.value
  else failed.value = true
}

// Bumped by each load, so a load it overtook is dropped.
let generation = 0

const loadEntries = async (from: Date): Promise<void> => {
  const asked = ++generation
  const result = await window.bulletin.habits
    .listEntries({
      from: localDate(from),
      to: localDate(endOfMonth(from))
    })
  if (asked !== generation) return
  if (result.ok)
    done.value = new Set(result.value.map(entryKey))
  else failed.value = true
}

/** The current Habit's Entry for `day`, if any. */
const entryOf = (day: Date): HabitEntry | null =>
  current.value && {
    habitId: current.value.id,
    date: localDate(day)
  }

const isDone = (day: Date): boolean => {
  const entry = entryOf(day)
  return entry !== null && done.value.has(entryKey(entry))
}

const label = (day: Date): string =>
  isDone(day) ? 'Done' : 'Not done'

const colour = (day: Date): string | undefined =>
  isDone(day) ? 'var(--color-text)' : undefined

const beforeCreation = (day: Date): boolean =>
  current.value !== null
  && localDate(day) < current.value.created

const setDone = (key: string, value: boolean): void => {
  const next = new Set(done.value)
  if (value) next.add(key)
  else next.delete(key)
  done.value = next
}

/** Days being written, by `entryKey`. */
const writing = new Set<string>()

const toggle = async (day: Date): Promise<void> => {
  const entry = entryOf(day)
  if (!entry) return
  const key = entryKey(entry)
  if (writing.has(key)) return
  const was = done.value.has(key)
  writing.add(key)
  setDone(key, !was)
  error.value = null
  const { habits: api } = window.bulletin
  const result = was
    ? await api.deleteEntry(entry)
    : await api.createEntry(entry)
  writing.delete(key)
  if (result.ok) return
  setDone(key, was)
  error.value = 'Couldn’t save that day. Try again.'
}

void loadHabits()

watch(
  () => month.value.getTime(),
  () => {
    error.value = null
    void loadEntries(month.value)
  },
  { immediate: true }
)
</script>

<template>
  <Widget class="habits-widget" title="Habits">
    <template v-if="current" #actions>
      <span class="name">{{ current.name }}</span>
    </template>
    <p v-if="failed" class="message" role="alert">
      Couldn’t load the Habits.
    </p>
    <p v-else-if="habits && !current" class="message">
      No habits yet
    </p>
    <div v-else-if="current" class="content">
      <MonthGrid
        :month="month"
        :label="label"
        :colour="colour"
        :disabled="beforeCreation"
        @activate="toggle"
      />
      <p v-if="error" class="message" role="alert">
        {{ error }}
      </p>
    </div>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.habits-widget {
  > .header > .actions > .name {
    font-size: rem(13px);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .content {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    height: 100%;
  }

  // Figma's glow around a done Day Pill.
  .pill.-filled {
    box-shadow: 0 0 rem(9px)
      color-mix(in sRGB, var(--pill-colour) 60%, transparent);
  }

  .message {
    font-size: rem(11px);
    color: var(--color-text-muted);
  }
}
</style>
