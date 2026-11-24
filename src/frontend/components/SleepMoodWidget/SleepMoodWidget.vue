<script setup lang="ts">
// Sleep & Mood (Figma 3859:6840): all-time Night ×
// Mood shares by asleep length. Night.day ↔ Mood
// (ADR 0004). `revision` reloads after Timeline edits.
import { computed, ref, shallowRef, watch } from 'vue'
import {
  MOODS,
  MOOD_DISPLAY_ORDER,
  type MoodKey
} from '@shared/mood'
import { localDate } from '@shared/dates'
import Widget from '@/components/Widget/Widget.vue'
import { moodColour } from '@/theme/semantic'
import {
  sleepMood,
  type SleepMoodHeadline,
  type SleepMoodView
} from '@/sleep/sleep-mood'
import {
  sleepDays,
  sleepFetchRange,
  type Stretch
} from '@/sleep/stretches'
import { useSelectedDateStore }
  from '@/stores/selected-date'

const props = defineProps<{ revision?: number }>()
const store = useSelectedDateStore()
const empty: SleepMoodView = {
  buckets: sleepMood([], []).buckets, headline: null
}
const view = shallowRef(empty)
const failed = ref(false)
let generation = 0

const load = async (): Promise<void> => {
  const asked = ++generation
  const to = localDate(store.day)
  const range = { from: '1970-01-01' as const, to }
  const [moods, periods] = await Promise.all([
    window.bulletin.mood.list(range),
    window.bulletin.sleep.list(sleepFetchRange(range))
  ])
  if (asked !== generation) return
  if (!moods.ok || !periods.ok) {
    failed.value = true
    view.value = empty
    return
  }
  failed.value = false
  view.value = sleepMood(
    sleepDays(periods.value, range)
      .map(d => d.night)
      .filter((n): n is Stretch => n !== null),
    moods.value
  )
}

watch(
  () => [localDate(store.day), props.revision ?? 0] as const,
  () => { void load() }, { immediate: true }
)

const headlineText = computed((): string | null => {
  const h = view.value.headline
  return h
    ? `${h.percent}% ${h.mood} after ${h.bucketLabel}`
    : null
})

const legend = MOOD_DISPLAY_ORDER.map(k =>
  MOODS.find(m => m.key === k)!)

const winning = (
  mood: MoodKey,
  id: string,
  h: SleepMoodHeadline | null
): boolean => !!h && h.mood === mood && h.bucketId === id

const segmentStyle = (
  mood: MoodKey,
  share: number,
  glow: boolean
): Record<string, string> => {
  const colour = moodColour(MOODS.find(m => m.key === mood)!)
  const style: Record<string, string> = {
    flexGrow: String(share),
    flexBasis: '0',
    background:
      `color-mix(in sRGB, ${colour} 85%, transparent)`
  }
  if (glow) {
    style.boxShadow = `0 0 8px 0 color-mix(in sRGB, ${
      colour} 45%, transparent)`
  }
  return style
}
</script>

<template>
  <Widget
    class="sleep-mood"
    title="Sleep & Mood"
    icon="sleep-mood"
  >
    <template v-if="headlineText" #actions>
      <p class="headline">
        {{ headlineText }}
      </p>
    </template>
    <p
      v-if="failed"
      class="error"
      role="alert"
    >
      Couldn’t load Sleep & Mood.
    </p>
    <div v-else class="body-inner">
      <div
        v-for="bucket in view.buckets"
        :key="bucket.id"
        class="row"
      >
        <span class="label">{{ bucket.label }}</span>
        <div
          class="track"
          :class="{ '-empty': bucket.total === 0 }"
        >
          <div
            v-for="seg in bucket.segments"
            :key="seg.mood"
            class="segment"
            :class="{
              '-glow': winning(
                seg.mood, bucket.id, view.headline
              )
            }"
            :style="segmentStyle(
              seg.mood,
              seg.share,
              winning(seg.mood, bucket.id, view.headline)
            )"
          >
            <span v-if="seg.showLabel" class="percent">
              {{ seg.percent }}%
            </span>
          </div>
        </div>
      </div>
      <ul class="legend" aria-label="Mood legend">
        <li
          v-for="item in legend"
          :key="item.key"
          class="item"
        >
          <span
            class="swatch"
            :style="{ background: moodColour(item) }"
          />
          <span class="name">{{ item.label }}</span>
        </li>
      </ul>
    </div>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.sleep-mood {
  --widget-gap: #{rem(14px)};

  > .header > .actions > .headline {
    margin: 0;
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-widget-title);
  }

  > .body > .error {
    font-size: rem(11px);
    color: var(--color-text-muted);
  }

  > .body > .body-inner {
    display: flex;
    flex-direction: column;
    gap: rem(14px);
    min-width: 0;
  }

  .row {
    display: grid;
    grid-template-columns: rem(46px) minmax(0, 1fr);
    align-items: center;
    min-width: 0;

    > .label {
      font-size: rem(10px);
      font-weight: 700;
      text-transform: uppercase;
      color: rgb(165 165 165 / 60%);
    }

    > .track {
      display: flex;
      gap: rem(2px);
      min-width: 0;
      height: rem(16px);

      &.-empty {
        background: var(--color-sleep-track);
        border-radius: rem(4px);
      }
    }
  }

  .segment {
    display: grid;
    place-items: center start;
    min-width: 0;
    height: 100%;
    padding-inline: rem(6px);
    border-radius: rem(4px);

    > .percent {
      font-family: $font-family-mono;
      font-size: rem(9px);
      font-weight: 500;
      color: rgb(26 26 26 / 85%);
      white-space: nowrap;
    }
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: rem(10px) rem(14px);
    margin: rem(10px) 0 0;
    padding: 0;
    list-style: none;

    > .item {
      display: flex;
      gap: rem(4px);
      align-items: center;
    }

    .swatch {
      flex: none;
      width: rem(6px);
      height: rem(6px);
      border-radius: 50%;
    }

    .name {
      font-size: rem(9px);
      font-weight: 700;
      text-transform: uppercase;
      color: var(--color-widget-title);
    }
  }
}
</style>
