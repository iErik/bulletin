<script setup lang="ts">
// The Weight Widget's chart: Entries over 11 months
// centred on `day`, as a glowing area under a monotone
// curve. The glow marks `day` on the curve. Hovering,
// or ← and → while focused, snaps a dashed line and a
// tooltip to the nearest Entry.
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch
} from 'vue'
import { getDaysInMonth } from 'date-fns'
import { scaleLinear } from 'd3-scale'
import { area, curveMonotoneX, line } from 'd3-shape'
import type { WeightEntry } from '@shared/weight'
import { formatDate } from '@/locale/format'
import {
  chartPoints,
  chartWindow,
  curveAt,
  dayX,
  nearestIndex,
  windowDays,
  yDomain,
  yTicks,
  type Point
} from '@/weight/chart'
import { formatAxisKg, formatWeight } from '@/weight/format'

const props = defineProps<{
  /** The Selected Date. */
  day: Date
  /** Oldest first, including any outside the window. */
  entries: readonly WeightEntry[]
  /** Whether loading the Entries failed. */
  failed?: boolean
}>()

// Room for the axis labels, in pixels.
const PAD = { top: 8, right: 4, bottom: 22, left: 44 }
const GLOW_RADIUS = 64

const root = ref<HTMLElement>()
const size = ref({ width: 375, height: 150 })
let observer: ResizeObserver | undefined

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(([{ contentRect }]) => {
    size.value = {
      width: contentRect.width,
      height: contentRect.height
    }
  })
  observer.observe(root.value!)
})

onBeforeUnmount(() => observer?.disconnect())

const frame = computed(() => chartWindow(props.day))
const points = computed(() =>
  chartPoints(frame.value, props.entries)
)
const visible = computed(() => points.value.visible)
const domain = computed(() =>
  yDomain(visible.value.map(p => p.y))
)

const plot = computed(() => ({
  left: PAD.left,
  right: size.value.width - PAD.right,
  top: PAD.top,
  bottom: size.value.height - PAD.bottom
}))

const x = computed(() =>
  scaleLinear()
    .domain([0, windowDays(frame.value)])
    .range([plot.value.left, plot.value.right])
)
const y = computed(() =>
  scaleLinear()
    .domain(domain.value)
    .range([plot.value.bottom, plot.value.top])
)

const curve = computed(() => {
  const px = (p: Point): number => x.value(p.x)
  const py = (p: Point): number => y.value(p.y)
  return {
    area: area<Point>(px, plot.value.bottom, py)
      .curve(curveMonotoneX)(points.value.curve) ?? '',
    line: line<Point>(px, py)
      .curve(curveMonotoneX)(points.value.curve) ?? ''
  }
})

const glow = computed(() => {
  const at = dayX(frame.value, props.day)
  const kg = curveAt(points.value.curve, at)
  return kg === undefined
    ? undefined
    : { cx: x.value(at), cy: y.value(kg) }
})

const months = computed(() =>
  frame.value.months.map((month, i) => ({
    key: month.getTime(),
    label: i % 2 === 0
      ? formatDate(month, 'monthShort')
      : '',
    // Under the month's middle
    x: x.value(
      dayX(frame.value, month) - 0.5
        + getDaysInMonth(month) / 2
    )
  }))
)

const ticks = computed(() =>
  yTicks(domain.value).map(kg => ({
    kg,
    label: formatAxisKg(kg),
    y: y.value(kg)
  }))
)

const label = computed(() => {
  const { months } = frame.value
  const from = formatDate(months[0], 'monthYear')
  const to = formatDate(
    months[months.length - 1],
    'monthYear'
  )
  return `Weight chart, ${from} to ${to}`
})

// The Entry the dashed line and tooltip snap to.
const active = ref<number>()
const point = computed(() =>
  active.value === undefined
    ? undefined
    : visible.value[active.value]
)
const tip = computed(() => {
  const p = point.value
  if (!p) return undefined
  const left = x.value(p.x)
  return {
    left,
    top: y.value(p.y),
    // Left of the line towards the right edge
    flipped: left > size.value.width * 0.6,
    text: `${formatDate(p.date, 'short')}, `
      + formatWeight(p.entry.grams)
  }
})

// A reload can remove the Entry it was on.
watch(visible, () => {
  active.value = undefined
})

const snap = (index: number): void => {
  active.value = index < 0 ? undefined : index
}

const onPointerMove = (event: PointerEvent): void => {
  const { left } = (event.currentTarget as Element)
    .getBoundingClientRect()
  const at = x.value.invert(event.clientX - left)
  snap(nearestIndex(visible.value, at))
}

const hide = (): void => {
  active.value = undefined
}

const STEPS: Readonly<Record<string, -1 | 1>> = {
  ArrowLeft: -1,
  ArrowRight: 1
}

// From the Entry nearest the Selected Date, then one
// Entry at a time.
const stepFrom = (step: -1 | 1): number =>
  active.value === undefined
    ? nearestIndex(
        visible.value,
        dayX(frame.value, props.day)
      )
    : Math.min(
        Math.max(active.value + step, 0),
        visible.value.length - 1
      )

// Stops the keys reaching the date header, which
// would otherwise step the Selected Date.
const onKeydown = (event: KeyboardEvent): void => {
  const step = STEPS[event.key]
  if (step) snap(stepFrom(step))
  else if (event.key === 'Escape') hide()
  else return
  event.preventDefault()
  event.stopPropagation()
}

const ids = {
  clip: useId(),
  fill: useId(),
  glow: useId(),
  under: useId()
}
const url = (id: string): string => `url(#${id})`
</script>

<template>
  <div ref="root" class="weight-chart">
    <svg
      class="plot"
      :width="size.width"
      :height="size.height"
      tabindex="0"
      role="img"
      :aria-label="label"
      @pointermove="onPointerMove"
      @pointerleave="hide"
      @keydown="onKeydown"
      @blur="hide"
    >
      <defs>
        <clipPath :id="ids.clip">
          <rect
            :x="plot.left"
            :y="plot.top"
            :width="plot.right - plot.left"
            :height="plot.bottom - plot.top"
          />
        </clipPath>
        <clipPath :id="ids.under">
          <path :d="curve.area" />
        </clipPath>
        <linearGradient
          :id="ids.fill"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop class="fill-top" offset="0" />
          <stop class="fill-bottom" offset="1" />
        </linearGradient>
        <radialGradient :id="ids.glow">
          <stop class="glow-centre" offset="0" />
          <stop class="glow-edge" offset="1" />
        </radialGradient>
      </defs>

      <text
        v-for="tick in ticks"
        :key="tick.kg"
        class="tick"
        :x="0"
        :y="tick.y"
      >
        {{ tick.label }}
      </text>
      <text
        v-for="month in months"
        :key="month.key"
        class="month"
        :x="month.x"
        :y="size.height - 4"
      >
        {{ month.label }}
      </text>

      <g :clip-path="url(ids.clip)">
        <path
          class="area"
          :d="curve.area"
          :fill="url(ids.fill)"
        />
        <circle
          v-if="glow"
          class="glow"
          :cx="glow.cx"
          :cy="glow.cy"
          :r="GLOW_RADIUS"
          :fill="url(ids.glow)"
          :clip-path="url(ids.under)"
        />
        <path class="line" :d="curve.line" />
      </g>

      <line
        v-if="tip"
        class="cursor"
        :x1="tip.left"
        :x2="tip.left"
        :y1="0"
        :y2="plot.bottom"
      />
    </svg>

    <p
      v-if="tip"
      class="tooltip"
      :class="{ '-flipped': tip.flipped }"
      role="status"
      :style="{ left: `${tip.left}px`, top: `${tip.top}px` }"
    >
      {{ tip.text }}
    </p>
    <p v-if="failed" class="notice" role="alert">
      Couldn't load your weight
    </p>
    <p v-else-if="points.curve.length === 0" class="notice">
      No weight logged yet
    </p>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.weight-chart {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;

  > .plot {
    display: block;
    border-radius: $radius-small;
    @include focus-ring;
  }

  > .plot > .tick,
  > .plot > .month {
    font-size: rem(10px);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    fill: var(--color-text-muted);
  }

  > .plot > .tick { dominant-baseline: middle; }
  > .plot > .month { text-anchor: middle; }

  .fill-top {
    stop-color: var(--color-text);
    stop-opacity: 0.22;
  }

  .fill-bottom {
    stop-color: var(--color-text);
    stop-opacity: 0.02;
  }

  .glow-centre {
    stop-color: var(--color-text);
    stop-opacity: 0.75;
  }

  .glow-edge {
    stop-color: var(--color-text);
    stop-opacity: 0;
  }

  .line {
    fill: none;
    stroke: var(--color-text-muted);
    stroke-width: 1.5;
  }

  .cursor {
    stroke: var(--color-text);
    stroke-dasharray: 4 3;
    stroke-width: 1;
  }

  // Beside the Entry, as in Figma.
  > .tooltip {
    position: absolute;
    padding: space(1) space(2);
    font-size: rem(11px);
    white-space: nowrap;
    color: var(--color-text);
    pointer-events: none;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: $radius-small;
    transform: translate(#{space(1)}, -50%);

    &.-flipped {
      transform:
        translate(calc(-100% - #{space(1)}), -50%);
    }
  }

  > .notice {
    position: absolute;
    inset: 0 0 rem(22px) rem(44px);
    display: grid;
    place-items: center;
    font-size: rem(12px);
    color: var(--color-text-muted);
    pointer-events: none;
  }
}
</style>
