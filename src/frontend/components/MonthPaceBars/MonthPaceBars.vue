<script setup lang="ts">
// The Month Pace Widget's bottom section: Daily spend
// bars aligned with the running-total chart's days,
// with bright bars from 2× the average, a 4× cap marked
// with `↑`, placeholder dashes for days left, and the
// daily average caption (with Large Expenses noted).
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef
} from 'vue'
import { formatAmount } from '@/expenses/money'
import type { MonthPace } from '@/expenses/month-pace'
import {
  dayBars,
  dayFraction,
  dayLabels,
  largeExpenseLabel
} from '@/expenses/month-pace-chart'

const props = withDefaults(defineProps<{
  pace: MonthPace
  /** Left edge of the plot (day 1's centre), in px. */
  padLeft?: number
  /** Margin right of the plot (last day's centre), in px. */
  padRight?: number
}>(), {
  // Figma's 720px card has 10px Widget inset, so the
  // 66..700 plot sits at 56..690 inside the 700px body.
  padLeft: 56,
  padRight: 10
})

const DEFAULT_WIDTH = 700
const BAR_WIDTH = 12
const BAR_MIN_WIDTH = 2
const BAR_MIN_GAP = 2
const BAR_MAX_HEIGHT = 92
const BAR_RADIUS = 3
const REST_HEIGHT = 2
const REST_RADIUS = 1

// Figma puts the full bar's top 8px below the header,
// with `↑` 12px above it, overflowing into the header
// row; the day labels sit 10px below the baseline, and
// the room under them pads the Widget's bottom.
const PAD_TOP = 8
const CAP_Y = PAD_TOP - 7
const BASELINE = PAD_TOP + BAR_MAX_HEIGHT
const REST_Y = BASELINE - REST_HEIGHT
const LABEL_Y = BASELINE + 15.5
const SVG_HEIGHT = BASELINE + 30

const root = useTemplateRef<HTMLElement>('root')
const width = ref(DEFAULT_WIDTH)
let observer: ResizeObserver | undefined

onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !root.value)
    return
  observer = new ResizeObserver(([{ contentRect }]) => {
    if (contentRect.width > 0)
      width.value = contentRect.width
  })
  observer.observe(root.value)
})

onBeforeUnmount(() => observer?.disconnect())

const totalDays = computed(() => props.pace.days.length)

const plot = computed(() => {
  const left = props.padLeft
  const right = Math.max(left, width.value - props.padRight)
  return { left, right, span: right - left }
})

const dayX = (day: number): number =>
  plot.value.left
  + dayFraction(day, totalDays.value) * plot.value.span

const barWidth = computed(() => {
  if (totalDays.value <= 1) return BAR_WIDTH
  const step = plot.value.span / (totalDays.value - 1)
  return Math.min(
    BAR_WIDTH,
    Math.max(BAR_MIN_WIDTH, step - BAR_MIN_GAP)
  )
})

const bars = computed(() => {
  const w = barWidth.value
  return dayBars(props.pace).map(bar => {
    const cx = dayX(bar.day)
    const height = bar.height * BAR_MAX_HEIGHT
    return {
      ...bar,
      cx,
      x: cx - w / 2,
      width: w,
      height,
      y: BASELINE - height
    }
  })
})

const labels = computed(() =>
  dayLabels(totalDays.value).map(day => ({
    day,
    x: dayX(day)
  }))
)

const excluded = computed(() =>
  largeExpenseLabel(props.pace.largeExpenses)
)

const average = computed(() =>
  formatAmount(props.pace.averagePerDay)
)

const caption = computed(() => {
  const base = `avg ${average.value} / day`
  return excluded.value
    ? `${base}  (excl. ${excluded.value})`
    : base
})

const ariaLabel = computed(() => {
  const base = `Daily spend, average ${average.value} per day`
  return excluded.value
    ? `${base}, excluding ${excluded.value}`
    : base
})
</script>

<template>
  <div ref="root" class="month-pace-bars">
    <div class="header">
      <h3 class="heading">
        Daily spend
      </h3>
      <p class="caption">
        {{ caption }}
      </p>
    </div>
    <svg
      class="plot"
      :width="width"
      :height="SVG_HEIGHT"
      role="img"
      :aria-label="ariaLabel"
    >
      <template v-for="bar in bars" :key="bar.day">
        <rect
          v-if="bar.rest"
          class="rest"
          :data-day="bar.day"
          :x="bar.x"
          :y="REST_Y"
          :width="bar.width"
          :height="REST_HEIGHT"
          :rx="REST_RADIUS"
        />
        <rect
          v-else-if="bar.height > 0"
          class="bar"
          :class="{ '-bright': bar.bright }"
          :data-day="bar.day"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          :rx="BAR_RADIUS"
        />
        <text
          v-if="bar.capped"
          class="cap"
          :data-day="bar.day"
          :x="bar.cx"
          :y="CAP_Y"
        >
          ↑
        </text>
      </template>

      <text
        v-for="item in labels"
        :key="item.day"
        class="day"
        :x="item.x"
        :y="LABEL_Y"
      >
        {{ item.day }}
      </text>
    </svg>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.month-pace-bars {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;

  > .header {
    display: flex;
    gap: rem(8px);
    align-items: flex-start;
    justify-content: space-between;
    padding: 0 rem(4px);
  }

  > .header > .heading {
    margin: 0;
    font-size: rem(10px);
    font-weight: 700;
    line-height: 1.2;
    color: var(--color-month-pace-label);
    text-transform: uppercase;
    white-space: nowrap;
  }

  > .header > .caption {
    margin: 0;
    font-size: rem(9px);
    font-weight: 700;
    line-height: 1.2;
    color: var(--color-widget-title);
    text-transform: uppercase;
    white-space: pre;
  }

  > .plot {
    display: block;
    overflow: visible;
  }

  > .plot > .bar {
    fill: var(--color-month-pace-bar);

    &.-bright {
      fill: var(--color-month-pace-bar-bright);
      filter: drop-shadow(0 0 5px var(--color-month-pace-bar-glow));
    }
  }

  > .plot > .rest {
    fill: var(--color-month-pace-rest);
  }

  > .plot > .cap {
    font-size: rem(9px);
    font-weight: 700;
    fill: var(--color-month-pace-cap);
    text-anchor: middle;
    dominant-baseline: central;
  }

  > .plot > .day {
    font-size: rem(9px);
    font-weight: 700;
    fill: var(--color-widget-title);
    text-anchor: middle;
    dominant-baseline: central;
  }
}
</style>
