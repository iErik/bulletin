<script setup lang="ts">
// Mood By Weekday (Figma 3889:7610): one stacked bar
// of Mood shares per weekday over the last 90 days,
// with the Overview's Best weekday in bold. It reloads
// when the Mood Data Source changes (ADR 0007).
import { computed, ref, shallowRef, watch } from 'vue'
import { localDate } from '@shared/dates'
import {
  MOODS,
  type Mood,
  type MoodEntry,
  type MoodKey
} from '@shared/mood'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import { firstDayOfWeek, formatDate } from '@/locale/format'
import { moodByWeekday } from '@/mood/by-weekday'
import { last90Range, wholePercent } from '@/mood/overview'
import { weekdays } from '@/month-grid/layout'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { moodColour } from '@/theme/semantic'

const store = useSelectedDateStore()
const version = useDataVersion('mood')
const entries = shallowRef<MoodEntry[]>([])
const loaded = ref(false)
const failed = ref(false)
// Bumped by each load, so a load it overtook is dropped.
let generation = 0

const date = computed(() => localDate(store.day))

const load = async (): Promise<void> => {
  const asked = ++generation
  const result = await window.bulletin.mood.list(
    last90Range(date.value)
  )
  if (asked !== generation) return
  failed.value = !result.ok
  if (result.ok) entries.value = result.value
  loaded.value = true
}

watch(
  [date, version],
  () => { void load() },
  { immediate: true }
)

const moodByKey = new Map<MoodKey, Mood>(
  MOODS.map(mood => [mood.key, mood])
)

const summary = computed(() => moodByWeekday(
  entries.value, date.value, firstDayOfWeek()
))

const columns = computed(() => {
  const { columns: items, best } = summary.value
  const days = weekdays(firstDayOfWeek())
  return items.map((column, i) => {
    const name = formatDate(days[i], 'weekday')
    const segments = column.segments.map(seg => {
      const mood = moodByKey.get(seg.mood)!
      return {
        ...seg,
        label: mood.label,
        colour: moodColour(mood)
      }
    })
    const shares = segments
      .map(s => `${wholePercent(s.share)}% ${s.label}`)
      .join(', ')
    return {
      weekday: column.weekday,
      label: name.toLocaleUpperCase(),
      best: column.weekday === best,
      description: `${name}: ${shares}`,
      segments
    }
  })
})
</script>

<template>
  <Widget
    class="mood-by-weekday"
    title="By Weekday"
    icon="mood"
  >
    <template v-if="!failed" #actions>
      <p class="subtitle">
        Last 90 days
      </p>
    </template>
    <p v-if="failed" class="message" role="alert">
      Couldn’t load By Weekday.
    </p>
    <p
      v-else-if="loaded && !summary.total"
      class="message"
    >
      No moods logged yet
    </p>
    <div v-else-if="loaded" class="columns">
      <div
        v-for="column in columns"
        :key="column.weekday"
        class="column"
      >
        <div class="track">
          <div
            v-if="column.segments.length"
            class="bar"
            role="img"
            :aria-label="column.description"
          >
            <span
              v-for="seg in column.segments"
              :key="seg.mood"
              class="segment"
              :data-mood="seg.mood"
              :style="{
                flexGrow: seg.share,
                '--mood': seg.colour
              }"
            />
          </div>
        </div>
        <span
          class="label"
          :class="{ '-best': column.best }"
        >{{ column.label }}</span>
      </div>
    </div>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.mood-by-weekday {
  --widget-gap: #{rem(13px)};

  padding-bottom: rem(12px);

  > .header > .actions > .subtitle {
    margin: 0 rem(4px) 0 0;
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-widget-title);
  }
}

.mood-by-weekday {
  .message {
    padding: space(2) rem(4px) 0;
    font-size: rem(12px);
    color: var(--color-text-muted);
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    height: 100%;
    padding: 0 rem(10px) 0 rem(4px);
  }

  .column {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 0;
  }

  .track {
    display: flex;
    flex: 1;
    justify-content: center;
    width: 100%;
    min-height: 0;
  }

  .bar {
    display: flex;
    flex-direction: column-reverse;
    gap: rem(2px);
    width: rem(26px);
    height: 100%;
  }

  .segment {
    flex-shrink: 0;
    flex-basis: 0;
    min-height: 0;
    background: color-mix(
      in sRGB, var(--mood) 85%, transparent
    );
    border-radius: rem(3px);
  }

  .label {
    margin-top: rem(9px);
    font-size: rem(10px);
    font-weight: 700;
    line-height: rem(12px);
    text-transform: uppercase;
    color: var(--color-widget-title);

    &.-best { color: var(--color-weekday-best); }
  }
}
</style>
