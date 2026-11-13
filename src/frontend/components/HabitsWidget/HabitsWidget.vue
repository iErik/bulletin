<script setup lang="ts">
// The Habits Widget: the current Habit's days in the
// Selected Date's month, on a Month Grid. Done Day
// Pills glow; days before the Habit was created are
// disabled. Activating a Day Pill toggles it and saves
// at once; if storage fails, it reverts and an inline
// error shows. The current Habit is remembered per
// device, falling back to the oldest active Habit.
// The header's Habit name opens the Habit list in
// place of the grid; the name, Escape or a click
// outside the Widget closes it. Without Habits, "+
// Track a new habit…" opens it to create one.
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import {
  endOfMonth,
  getDaysInMonth,
  startOfMonth
} from 'date-fns'
import type { Habit, HabitEntry } from '@shared/habits'
import { localDate } from '@shared/dates'
import HabitList from '@/components/HabitList/HabitList.vue'
import MonthGrid from '@/components/MonthGrid/MonthGrid.vue'
import Widget from '@/components/Widget/Widget.vue'
import {
  pickCurrentHabit,
  readCurrentHabitId,
  writeCurrentHabitId
} from '@/habits/current-habit'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { dayPill } from '@/theme/semantic'
import type { PillColours } from '@/theme/types'

const store = useSelectedDateStore()

/** The first of the Selected Date's month. */
const month = computed(() => startOfMonth(store.day))

/** The active Habits, oldest first; null till loaded. */
const habits = shallowRef<Habit[] | null>(null)
const chosen = ref(readCurrentHabitId())
const current = computed(() =>
  pickCurrentHabit(habits.value ?? [], chosen.value))

watch(current, habit => {
  if (!habit) return
  chosen.value = habit.id
  writeCurrentHabitId(habit.id)
})

const entryKey = (entry: HabitEntry): string =>
  `${entry.habitId} ${entry.date}`

/** The month's Habit Entries, by `entryKey`. */
const done = shallowRef(new Set<string>())
/** The month `done` holds, as a time; null till then. */
const loaded = ref<number | null>(null)
const habitsFailed = ref(false)
const entriesFailed = ref(false)
const error = ref<string | null>(null)

const loadError = computed(() =>
  habitsFailed.value
    ? 'Couldn’t load the Habits.'
    : entriesFailed.value
      ? 'Couldn’t load this month.'
      : null)

/** Days being written, by `entryKey`. */
const writing = new Set<string>()

const loadHabits = async (): Promise<void> => {
  const result = await window.bulletin.habits
    .list('active')
  if (result.ok) habits.value = result.value
  else habitsFailed.value = true
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
  entriesFailed.value = !result.ok
  if (!result.ok) return
  const next = new Set(result.value.map(entryKey))
  // Days still being written keep what the click set.
  for (const key of writing) {
    if (done.value.has(key)) next.add(key)
    else next.delete(key)
  }
  done.value = next
  loaded.value = from.getTime()
}

/**
 * The Entry `day` would have for the current Habit,
 * whether or not it exists; null without a Habit.
 */
const entryFor = (day: Date): HabitEntry | null =>
  current.value && {
    habitId: current.value.id,
    date: localDate(day)
  }

const isDone = (day: Date): boolean => {
  const entry = entryFor(day)
  return entry !== null && done.value.has(entryKey(entry))
}

const label = (day: Date): string =>
  isDone(day) ? 'Done' : 'Not done'

const pill = (day: Date): PillColours | undefined =>
  isDone(day) ? dayPill('habit') : undefined

const beforeCreation = (day: Date): boolean =>
  current.value !== null
  && localDate(day) < current.value.created

const setDone = (key: string, value: boolean): void => {
  const next = new Set(done.value)
  if (value) next.add(key)
  else next.delete(key)
  done.value = next
}

const toggle = async (day: Date): Promise<void> => {
  // Till the month loads, every day reads not done.
  if (loaded.value !== month.value.getTime()) return
  const entry = entryFor(day)
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

/** Each Habit's done days in the loaded month. */
const doneCounts = computed(() => {
  const counts = new Map<number, number>()
  for (const key of done.value) {
    const id = Number(key.split(' ')[0])
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
})

const doneIn = (habit: Habit): number =>
  doneCounts.value.get(habit.id) ?? 0

const listing = ref(false)
const frame = useTemplateRef<
  InstanceType<typeof Widget>
>('frame')
const nameButton = useTemplateRef<HTMLButtonElement>(
  'nameButton'
)
const trackButton = useTemplateRef<HTMLButtonElement>(
  'trackButton'
)
/** Whether the list opens on the new-habit field. */
const creating = ref(false)
const list = useTemplateRef<
  InstanceType<typeof HabitList>
>('list')

const frameElement = (): HTMLElement | undefined =>
  frame.value?.$el as HTMLElement | undefined

/**
 * Closes the list. Focus returns to the name button,
 * or without Habits to "+ Track a new habit…", unless
 * a click outside has already moved it away.
 */
const closeList = async (): Promise<void> => {
  listing.value = false
  creating.value = false
  const active = document.activeElement
  const el = frameElement()
  const away = active && active !== document.body
    && !el?.contains(active)
  await nextTick()
  if (away) return
  const button = nameButton.value ?? trackButton.value
  button?.focus()
}

const startTracking = (): void => {
  creating.value = true
  listing.value = true
}

const toggleList = (): void => {
  if (!listing.value) listing.value = true
  else if (!list.value?.busy) void closeList()
}

const choose = (habit: Habit): void => {
  chosen.value = habit.id
  void closeList()
}

/** Storage's order: oldest first, then by id. */
const byAge = (a: Habit, b: Habit): number =>
  a.created.localeCompare(b.created) || a.id - b.id

/** Adds a new or restored Habit; it's not made current. */
const onCreated = (habit: Habit): void => {
  habits.value = [...habits.value ?? [], habit]
    .sort(byAge)
}

const onUpdated = (habit: Habit): void => {
  habits.value = (habits.value ?? []).map(other =>
    other.id === habit.id ? habit : other)
}

const onArchived = (habit: Habit): void => {
  habits.value = (habits.value ?? [])
    .filter(other => other.id !== habit.id)
  // With no Habits left there's no list to show.
  if (!habits.value.length) listing.value = false
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape' || !listing.value) return
  event.preventDefault()
  event.stopPropagation()
  if (!list.value?.busy) void closeList()
}

const onDocumentClick = (event: Event): void => {
  if (!listing.value || list.value?.busy) return
  const el = frameElement()
  if (el && event.composedPath().includes(el)) return
  void closeList()
}

// Adding the same listener twice is a no-op.
watch(listing, open => {
  const method = open
    ? 'addEventListener'
    : 'removeEventListener'
  document[method]('click', onDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
})

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
  <Widget
    ref="frame"
    class="habits-widget"
    title="Habits"
    icon="checklist"
    @keydown="onKeydown"
  >
    <template v-if="current" #actions>
      <button
        ref="nameButton"
        class="name"
        :class="{ '-open': listing }"
        type="button"
        :aria-expanded="listing"
        @click="toggleList"
      >
        {{ current.name }}
      </button>
    </template>
    <p v-if="loadError" class="message" role="alert">
      {{ loadError }}
    </p>
    <HabitList
      v-else-if="habits && listing"
      ref="list"
      :habits="habits"
      :current="current?.id ?? null"
      :done="doneIn"
      :days="getDaysInMonth(month)"
      :creating="creating"
      @choose="choose"
      @archived="onArchived"
      @created="onCreated"
      @updated="onUpdated"
    />
    <div v-else-if="habits && !current" class="empty">
      <p class="message">
        No habits yet
      </p>
      <button
        ref="trackButton"
        class="track"
        type="button"
        @click="startTracking"
      >
        + Track a new habit…
      </button>
    </div>
    <div v-else-if="current" class="content">
      <MonthGrid
        :month="month"
        :label="label"
        :pill="pill"
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

// Figma's weekday row is 17px below the header.
.widget-frame.habits-widget { --widget-gap: #{rem(17px)}; }

.habits-widget {
  // Figma's closed name sits 15 px from the Widget's
  // edge, its open pill 10 px, in a 16 px text box.
  > .header > .actions > .name {
    margin-right: rem(5px);
    font-size: rem(13px);
    font-weight: 700;
    line-height: rem(16px);
    text-transform: uppercase;
    color: var(--color-widget-title);
    border-radius: rem(7px);
    @include colour-transition;
    @include focus-ring;
  }

  // Figma's open list puts the name on a pill.
  > .header > .actions > .name.-open {
    padding: rem(6px) space(4);
    margin: rem(-6px) 0;
    color: var(--color-habit-pill-text);
    background: var(--color-habit-pill);
  }

  .empty {
    display: flex;
    flex-direction: column;
    gap: space(1);
    align-items: flex-start;
  }

  .empty > .track {
    font-size: rem(13px);
    font-weight: 500;
    color: var(--color-text-muted);
    border-radius: rem(6px);
    @include focus-ring;

    &:hover { color: var(--color-text); }
  }

  .content {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    height: 100%;
  }

  .message {
    font-size: rem(11px);
    color: var(--color-text-muted);
  }
}
</style>
