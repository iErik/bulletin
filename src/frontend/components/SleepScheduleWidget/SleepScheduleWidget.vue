<script setup lang="ts">
// Sleep Schedule (Figma 3859:6828): Locale-week
// bedtime/wake dots, averages, ± consistency.
// Reloads when the Sleep Data Source changes.
import {
  computed,
  ref,
  shallowRef,
  watch
} from 'vue'
import { parseISO, startOfDay, startOfWeek } from 'date-fns'
import { localDate } from '@shared/dates'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import {
  firstDayOfWeek,
  formatDate
} from '@/locale/format'
import {
  axisLabel,
  axisRatio,
  clockOnAxis,
  placeOnAxis,
  scheduleAxis,
  scheduleStats,
  scheduleWeek,
  type ScheduleAxis,
  type ScheduleDay
} from '@/sleep/schedule'
import {
  sleepDays,
  sleepFetchRange,
  type Stretch
} from '@/sleep/stretches'
import { useSelectedDateStore }
  from '@/stores/selected-date'

interface RowView {
  readonly day: string
  readonly label: string
  readonly bed: number | null
  readonly wake: number | null
}

interface ChartView {
  readonly rows: readonly RowView[]
  readonly marks: readonly {
    readonly label: string
    readonly at: number
  }[]
  readonly averageBed: number | null
  readonly averageWake: number | null
  readonly deviationMin: number | null
}

const emptyChart = (axis: ScheduleAxis): ChartView => ({
  rows: [],
  marks: axis.marks.map(h => ({
    label: axisLabel(h),
    at: axisRatio(h, axis)
  })),
  averageBed: null,
  averageWake: null,
  deviationMin: null
})

const version = useDataVersion('sleep')
const store = useSelectedDateStore()
const chart = shallowRef(emptyChart(scheduleAxis([])))
const failed = ref(false)
let generation = 0

const build = (
  week: readonly ScheduleDay[],
  nights: readonly Stretch[]
): ChartView => {
  const axis = scheduleAxis(nights)
  const stats = scheduleStats(nights)
  const ratio = (hours: number): number =>
    axisRatio(hours, axis)
  return {
    rows: week.map(d => {
      const label = formatDate(
        parseISO(d.day), 'weekday'
      ).toLocaleUpperCase()
      if (!d.night) {
        return {
          day: d.day, label, bed: null, wake: null
        }
      }
      const span = placeOnAxis(d.night, axis)
      return {
        day: d.day,
        label,
        bed: ratio(span.bed),
        wake: ratio(span.wake)
      }
    }),
    marks: axis.marks.map(h => ({
      label: axisLabel(h),
      at: ratio(h)
    })),
    averageBed: stats.averageBed === null
      ? null
      : ratio(clockOnAxis(stats.averageBed, axis)),
    averageWake: stats.averageWake === null
      ? null
      : ratio(clockOnAxis(stats.averageWake, axis)),
    deviationMin: stats.deviationMin
  }
}

const load = async (): Promise<void> => {
  const asked = ++generation
  const selected = store.day
  const weekStartsOn = firstDayOfWeek()
  const weekStart = startOfWeek(startOfDay(selected), {
    weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6
  })
  const range = {
    from: localDate(weekStart),
    to: localDate(selected)
  }
  const periods = await window.bulletin.sleep.list(
    sleepFetchRange(range)
  )
  if (asked !== generation) return
  if (!periods.ok) {
    failed.value = true
    chart.value = emptyChart(scheduleAxis([]))
    return
  }
  failed.value = false
  const week = scheduleWeek(
    selected,
    sleepDays(periods.value, range).map(d => ({
      day: d.day,
      night: d.night
    })),
    weekStartsOn
  )
  const nights = week
    .map(d => d.night)
    .filter((n): n is Stretch => n !== null)
  chart.value = build(week, nights)
}

watch(
  () => [localDate(store.day), version.value] as const,
  () => { void load() },
  { immediate: true }
)

const deviation = computed((): string | null => {
  const n = chart.value.deviationMin
  return n === null ? null : `±${n} min`
})

const pct = (ratio: number): string =>
  `${ratio * 100}%`
</script>

<template>
  <Widget
    class="sleep-schedule"
    title="Schedule"
    icon="moon"
  >
    <template v-if="deviation" #actions>
      <p class="deviation">
        {{ deviation }}
      </p>
    </template>
    <p
      v-if="failed"
      class="error"
      role="alert"
    >
      Couldn’t load Schedule.
    </p>
    <div
      v-else
      class="chart"
      role="img"
      :aria-label="deviation
        ? `Sleep schedule, ${deviation}`
        : 'Sleep schedule'"
    >
      <div class="board">
        <div class="labels">
          <span
            v-for="row in chart.rows"
            :key="row.day"
            class="weekday"
          >
            {{ row.label }}
          </span>
        </div>
        <div class="plot">
          <div
            v-for="mark in chart.marks"
            :key="`g-${mark.label}-${mark.at}`"
            class="gridline"
            :style="{ left: pct(mark.at) }"
          />
          <div
            v-if="chart.averageBed !== null"
            class="average"
            :style="{ left: pct(chart.averageBed) }"
          />
          <div
            v-if="chart.averageWake !== null"
            class="average"
            :style="{ left: pct(chart.averageWake) }"
          />
          <div
            v-for="row in chart.rows"
            :key="row.day"
            class="track"
          >
            <template
              v-if="row.bed !== null && row.wake !== null"
            >
              <span
                class="span"
                :style="{
                  left: pct(row.bed),
                  width: pct(row.wake - row.bed)
                }"
              />
              <span
                class="dot"
                :style="{ left: pct(row.bed) }"
              />
              <span
                class="dot"
                :style="{ left: pct(row.wake) }"
              />
            </template>
          </div>
        </div>
      </div>
      <div class="axis" aria-hidden="true">
        <span
          v-for="mark in chart.marks"
          :key="`a-${mark.label}-${mark.at}`"
          class="mark"
          :style="{ left: pct(mark.at) }"
        >
          {{ mark.label }}
        </span>
      </div>
    </div>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.sleep-schedule {
  --widget-gap: #{rem(14px)};

  > .header > .actions > .deviation {
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

  > .body > .chart {
    display: flex;
    flex-direction: column;
    gap: rem(6px);
    min-width: 0;
    height: 100%;
  }

  .board {
    display: grid;
    flex: 1;
    grid-template-columns: rem(34px) minmax(0, 1fr);
    min-height: 0;
  }

  .labels {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .weekday {
    font-size: rem(10px);
    font-weight: 700;
    line-height: rem(17px);
    color: var(--color-widget-title);
    text-transform: uppercase;
  }

  .plot {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
  }

  .gridline,
  .average {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    pointer-events: none;
    transform: translateX(-50%);
  }

  .gridline {
    border-left: 0.5px solid var(--color-sleep-track);
  }

  .average {
    border-left: 1px dashed color-mix(
      in sRGB,
      var(--color-sleep-end) 40%,
      transparent
    );
  }

  .track {
    position: relative;
    z-index: 1;
    height: rem(17px);
  }

  .span {
    position: absolute;
    top: 50%;
    height: 1.5px;
    background: color-mix(
      in sRGB,
      var(--color-sleep-end) 22%,
      transparent
    );
    transform: translateY(-50%);
  }

  .dot {
    position: absolute;
    top: 50%;
    width: rem(6px);
    height: rem(6px);
    background: var(--color-sleep-end);
    border-radius: 50%;
    box-shadow: 0 0 rem(5px) 0 color-mix(
      in sRGB,
      var(--color-sleep-end) 70%,
      transparent
    );
    transform: translate(-50%, -50%);
  }

  .axis {
    position: relative;
    height: rem(12px);
    margin-left: rem(34px);
  }

  .mark {
    position: absolute;
    top: 0;
    font-size: rem(10px);
    font-weight: 700;
    line-height: rem(12px);
    color: var(--color-widget-title);
    text-transform: uppercase;
    transform: translateX(-50%);
  }
}
</style>
