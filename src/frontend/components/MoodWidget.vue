<script setup lang="ts">
// The Mood Widget: the Selected Date's month in a
// Month Grid, each Day Pill painted with its day's
// Mood. Activating a Day Pill swaps the grid for the
// picker; Escape or a click outside the Widget closes
// it without saving, and focus returns to that Day
// Pill. A save or clear updates the grid in place.
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import { endOfMonth, startOfMonth } from 'date-fns'
import {
  MOODS,
  type Mood,
  type MoodKey
} from '@shared/mood'
import { localDate } from '@shared/dates'
import type { LocalDate } from '@shared/storage'
import MonthGrid from '@/components/MonthGrid.vue'
import MoodPicker from '@/components/MoodPicker.vue'
import Widget from '@/components/Widget.vue'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { dayPill } from '@/theme/semantic'
import type { PillColours } from '@/theme/types'

const store = useSelectedDateStore()

/** The first of the Selected Date's month. */
const month = computed(() => startOfMonth(store.day))

/** The month's Moods, by day. */
const moods = shallowRef(new Map<LocalDate, MoodKey>())
const failed = ref(false)
// Bumped by each load, so a load it overtook is dropped.
let generation = 0

const load = async (from: Date): Promise<void> => {
  const asked = ++generation
  const result = await window.bulletin.mood.list({
    from: localDate(from),
    to: localDate(endOfMonth(from))
  })
  if (asked !== generation) return
  failed.value = !result.ok
  if (result.ok) {
    moods.value = new Map(result.value.map(entry =>
      [entry.date, entry.mood]))
  }
}

const moodOf = (day: Date): MoodKey | null =>
  moods.value.get(localDate(day)) ?? null

const moodFor = (day: Date): Mood | undefined => {
  const key = moodOf(day)
  return MOODS.find(mood => mood.key === key)
}

const label = (day: Date): string =>
  moodFor(day)?.label ?? 'No mood'

const pill = (day: Date): PillColours | undefined => {
  const mood = moodFor(day)
  return mood && dayPill(mood.key)
}

/** The day being edited in the picker, if any. */
const editing = shallowRef<Date | null>(null)

const root = useTemplateRef<HTMLElement>('root')
const grid = useTemplateRef<
  InstanceType<typeof MonthGrid>
>('grid')
const picker = useTemplateRef<
  InstanceType<typeof MoodPicker>
>('picker')

const close = async (): Promise<void> => {
  const day = editing.value
  editing.value = null
  // The grid is back once Vue has rendered.
  await nextTick()
  if (day) await grid.value?.focusDay(day)
}

const onSaved = (mood: MoodKey | null): void => {
  const day = editing.value
  if (!day) return
  const next = new Map(moods.value)
  if (mood) next.set(localDate(day), mood)
  else next.delete(localDate(day))
  moods.value = next
  void close()
}

// The path is taken when the click starts, so the Day
// Pill that opened the picker still counts as inside.
const onDocumentClick = (event: Event): void => {
  if (!editing.value || picker.value?.busy) return
  if (root.value
    && event.composedPath().includes(root.value))
    return
  void close()
}

// Adding the same listener twice is a no-op.
watch(editing, day => {
  const method = day
    ? 'addEventListener'
    : 'removeEventListener'
  document[method]('click', onDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
})

watch(
  () => month.value.getTime(),
  () => {
    editing.value = null
    void load(month.value)
  },
  { immediate: true }
)
</script>

<template>
  <div ref="root" class="mood-widget">
    <MoodPicker
      v-if="editing"
      ref="picker"
      :date="editing"
      :current="moodOf(editing)"
      @saved="onSaved"
      @close="close"
    />
    <Widget v-else class="mood-grid-frame" title="Mood" icon="mood">
      <p v-if="failed" class="error" role="alert">
        Couldn’t load the Moods.
      </p>
      <MonthGrid
        v-else
        ref="grid"
        :month="month"
        :label="label"
        :pill="pill"
        @activate="editing = $event"
      />
    </Widget>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma's weekday row is 17px below the header.
.widget-frame.mood-grid-frame { --widget-gap: #{rem(17px)}; }

// Holds the grid's frame or the picker's, filling the
// Dashboard's Mood area.
.mood-widget {
  display: grid;
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  min-width: 0;
  min-height: 0;

  .error {
    font-size: rem(11px);
    color: var(--color-text-muted);
  }
}
</style>
