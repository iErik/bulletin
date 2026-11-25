<script setup lang="ts">
// The Sleep Quality Widget (Figma 3859:6834): a Month
// Grid of the Selected Date's month, each rated Day
// Pill painted with Figma's white ramp. Days after the
// Selected Date are drawn empty and inert. Activating
// a Day Pill swaps in SleepQualityPicker; Escape or a
// click outside closes it and restores focus. Reloads
// when the month changes or the `sleepQuality` Data
// Source changes.
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import { endOfMonth, isAfter, startOfMonth } from 'date-fns'
import { localDate } from '@shared/dates'
import {
  SLEEP_QUALITY_STEPS,
  type SleepQualityEntry,
  type SleepQualityRating
} from '@shared/sleep-quality'
import type { LocalDate } from '@shared/storage'
import MonthGrid from '@/components/MonthGrid/MonthGrid.vue'
import SleepQualityPicker from
  '@/components/SleepQualityPicker/SleepQualityPicker.vue'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import { formatNumber } from '@/locale/format'
import {
  QUALITY_OPACITY,
  averageQuality
} from '@/sleep/quality'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { dayPill } from '@/theme/semantic'
import type { PillColours } from '@/theme/types'

const store = useSelectedDateStore()
const version = useDataVersion('sleepQuality')

/** The first of the Selected Date's month. */
const month = computed(() => startOfMonth(store.day))

/** The month's ratings, by day. */
const ratings = shallowRef(new Map<LocalDate, SleepQualityRating>())
const failed = ref(false)
// Bumped by each load, so a load it overtook is dropped.
let generation = 0

const load = async (from: Date): Promise<void> => {
  const asked = ++generation
  const result = await window.bulletin.sleepQuality.list({
    from: localDate(from),
    to: localDate(endOfMonth(from))
  })
  if (asked !== generation) return
  failed.value = !result.ok
  if (result.ok) {
    ratings.value = new Map(result.value.map(entry =>
      [entry.date, entry.rating]))
  }
}

const entries = computed<SleepQualityEntry[]>(() =>
  [...ratings.value].map(([date, rating]) =>
    ({ date, rating })))

const average = computed<string | null>(() => {
  const mean = averageQuality(entries.value, store.day)
  if (mean === null) return null
  const formatted = formatNumber(mean, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })
  return `Avg ${formatted}`
})

const isAfterSelected = (day: Date): boolean =>
  isAfter(day, store.day)

const ratingOf = (day: Date): SleepQualityRating | null =>
  isAfterSelected(day)
    ? null
    : (ratings.value.get(localDate(day)) ?? null)

const label = (day: Date): string =>
  SLEEP_QUALITY_STEPS.find(step =>
    step.value === ratingOf(day))?.label ?? 'Not rated'

const pill = (day: Date): PillColours | undefined =>
  ratingOf(day) === null ? undefined : dayPill('quality')

const opacity = (day: Date): number | undefined => {
  const rating = ratingOf(day)
  return rating === null ? undefined : QUALITY_OPACITY[rating]
}

/** The day being edited in the picker, if any. */
const editing = shallowRef<Date | null>(null)

const root = useTemplateRef<HTMLElement>('root')
const grid = useTemplateRef<
  InstanceType<typeof MonthGrid>
>('grid')
const picker = useTemplateRef<
  InstanceType<typeof SleepQualityPicker>
>('picker')

const close = async (): Promise<void> => {
  const day = editing.value
  editing.value = null
  // The grid is back once Vue has rendered.
  await nextTick()
  if (day) await grid.value?.focusDay(day)
}

const onSaved = (rating: SleepQualityRating | null): void => {
  const day = editing.value
  if (!day) return
  const next = new Map(ratings.value)
  if (rating !== null) next.set(localDate(day), rating)
  else next.delete(localDate(day))
  ratings.value = next
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
  () => { editing.value = null }
)

watch(
  () => store.day.getTime(),
  () => {
    if (editing.value && isAfterSelected(editing.value))
      editing.value = null
  }
)

watch(
  [() => month.value.getTime(), version],
  () => { void load(month.value) },
  { immediate: true }
)
</script>

<template>
  <div ref="root" class="sleep-quality-widget">
    <SleepQualityPicker
      v-if="editing"
      ref="picker"
      :date="editing"
      :current="ratingOf(editing)"
      @saved="onSaved"
      @close="close"
    />
    <Widget
      v-else
      class="sleep-quality-frame"
      title="Quality"
      icon="checklist"
    >
      <template v-if="!failed && average" #actions>
        <p class="average">
          {{ average }}
        </p>
      </template>
      <p v-if="failed" class="error" role="alert">
        Couldn’t load Sleep Quality.
      </p>
      <div v-else class="content">
        <MonthGrid
          ref="grid"
          :month="month"
          :label="label"
          :pill="pill"
          :opacity="opacity"
          :disabled="isAfterSelected"
          @activate="editing = $event"
        />
        <footer class="footer">
          <div class="legend" aria-hidden="true">
            <span class="bound">Poor</span>
            <span class="ramp">
              <span
                v-for="step in SLEEP_QUALITY_STEPS"
                :key="step.value"
                class="swatch"
                :style="{
                  '--pill-opacity': QUALITY_OPACITY[step.value]
                }"
              >
                <span class="base" />
                <span class="glow" />
              </span>
            </span>
            <span class="bound">Great</span>
          </div>
          <span class="caption">Rated after waking</span>
        </footer>
      </div>
    </Widget>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

@function glow($colour, $alpha) {
  @return color-mix(in sRGB, #{$colour} $alpha, transparent);
}

// Figma's Sleep / Quality (3859:6834): weekdays sit 12px
// below the header at 34% grey, rows 11px below weekdays,
// and the Poor–Great footer is pinned to the bottom.
.widget-frame.sleep-quality-frame {
  --widget-gap: #{rem(12px)};
  --color-weekday: var(--color-widget-title);

  // Figma insets the average 14px, like the grid.
  > .header > .actions > .average {
    margin: 0 rem(4px) 0 0;
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-widget-title);
  }

  .month-grid {
    height: auto;

    > .weekday { margin-bottom: rem(4px); }
  }
}

.sleep-quality-widget {
  display: grid;
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  min-width: 0;
  min-height: 0;

  .error {
    font-size: rem(11px);
    color: var(--color-text-muted);
  }

  .content {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .footer {
    display: flex;
    gap: rem(8px);
    align-items: center;
    justify-content: space-between;
    padding: 0 rem(4px) rem(6px);
    margin-top: auto;
    font-size: rem(9px);
    font-weight: 700;
    line-height: rem(11px);
    text-transform: uppercase;
    color: var(--color-widget-title);
  }

  // Figma: 4px from POOR to the ramp, 6px to GREAT.
  .legend {
    display: flex;
    gap: rem(4px);
    align-items: center;
  }

  .ramp {
    display: flex;
    gap: rem(4px);
    align-items: center;
    margin-right: rem(2px);
  }

  // Only the legend's: the picker has swatches too.
  .ramp > .swatch {
    position: relative;
    width: rem(16px);
    height: rem(6px);
    border-radius: rem(4px);

    > .base {
      position: absolute;
      inset: 0;
      background: var(--color-pill-quality-base);
      filter: blur(1.5px);
      border-radius: rem(4px);
      opacity: var(--pill-opacity, 1);
    }

    > .glow {
      position: absolute;
      inset: 25% 7.5%;
      background: var(--color-pill-quality-glow);
      filter: blur(1.75px);
      border-radius: rem(6px);
      opacity: var(--pill-opacity, 1);
      box-shadow:
        0 0 17.5px glow(var(--color-pill-quality-shadow), 38%),
        0 2px 5px glow(var(--color-pill-quality-tint), 35%),
        0 0 9.2px glow(var(--color-pill-quality-shadow), 82%),
        0 0 13.4px 7px glow(
          var(--color-pill-quality-shadow), 12%
        );
    }
  }
}
</style>
