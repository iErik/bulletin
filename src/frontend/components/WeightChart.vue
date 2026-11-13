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
import {
  formatAxisKg,
  formatWeight
} from '@/weight/format'

const props = defineProps<{
  /** The Selected Date. */
  day: Date
  /** Oldest first, including any outside the window. */
  entries: readonly WeightEntry[]
  /** Whether loading the Entries failed. */
  failed?: boolean
}>()

// Room for the axis labels, in pixels, from the
// Weight frame: the top tick 25px down, the bottom one
// 20px up, the kg labels in the left 38px.
const PAD = { top: 25, right: 3, bottom: 20, left: 38 }
// The grid lines stop short of the plot's right edge.
const GRID_INSET = 14.5
// The month labels' middles, below the bottom tick
const MONTH_GAP = 17
// Each month label starts this far before its month.
const MONTH_LEAD = 4
const GLOW_RADIUS = 64
// Half the tooltip's height, to keep it inside.
const TIP_HALF = 14

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

const span = computed(() => chartWindow(props.day))
const points = computed(() =>
  chartPoints(span.value, props.entries)
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
    .domain([0, windowDays(span.value)])
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

// A lone Entry has no curve to draw, so it gets a dot.
// One just outside the window would be clipped away.
const dot = computed(() => {
  const only = visible.value
  const lone = points.value.curve.length === 1
  return lone && only.length === 1
    ? { cx: x.value(only[0].x), cy: y.value(only[0].y) }
    : undefined
})

// Nothing shows without an Entry in the window or a
// curve crossing it.
const empty = computed(() =>
  visible.value.length === 0
  && points.value.curve.length < 2
)

const glow = computed(() => {
  const at = dayX(span.value, props.day)
  const kg = curveAt(points.value.curve, at)
  return kg === undefined
    ? undefined
    : { cx: x.value(at), cy: y.value(kg) }
})

const months = computed(() =>
  span.value.months.map((month, i) => ({
    key: month.getTime(),
    label: i % 2 === 0
      ? formatDate(month, 'monthShort')
      : '',
    // From just before the month's first day
    x: x.value(dayX(span.value, month) - 0.5)
      - MONTH_LEAD
  }))
)

const ticks = computed(() =>
  yTicks(domain.value).map(kg => ({
    kg,
    label: formatAxisKg(kg),
    y: y.value(kg)
  }))
)

// At every tick but the bottom one, top down.
const grid = computed(() =>
  ticks.value.slice(1).reverse()
)

const label = computed(() => {
  const { months } = span.value
  const from = formatDate(months[0], 'monthYear')
  const to = formatDate(
    months[months.length - 1],
    'monthYear'
  )
  return `Weight chart, ${from} to ${to}`
})

// The visible Entry the dashed line and tooltip snap
// to: never an interpolated value.
const active = ref<number>()
const tip = computed(() => {
  const p = active.value === undefined
    ? undefined
    : visible.value[active.value]
  if (!p) return undefined
  const left = x.value(p.x)
  const at = y.value(p.y)
  return {
    left,
    y: at,
    top: Math.min(
      Math.max(at, TIP_HALF),
      size.value.height - TIP_HALF
    ),
    // Left of the line towards the right edge
    flipped: left > size.value.width * 0.6,
    text: `${formatDate(p.date, 'short')}, `
      + formatWeight(p.entry.grams)
  }
})

// Another month or a reload can drop its Entry.
watch(visible, () => {
  active.value = undefined
})

const hide = (): void => {
  active.value = undefined
}

// No Entry in the window (-1) hides it.
const snap = (index: number): void => {
  active.value = index < 0 ? undefined : index
}

const onPointerMove = (event: PointerEvent): void => {
  const { left } = (event.currentTarget as Element)
    .getBoundingClientRect()
  snap(nearestIndex(
    visible.value,
    x.value.invert(event.clientX - left)
  ))
}

const STEPS: Readonly<Record<string, -1 | 1>> = {
  ArrowLeft: -1,
  ArrowRight: 1
}

// From the Entry nearest the Selected Date, then one
// Entry at a time, stopping at the ends.
const stepFrom = (step: -1 | 1): number =>
  active.value === undefined
    ? nearestIndex(
        visible.value,
        dayX(span.value, props.day)
      )
    : Math.min(
        Math.max(active.value + step, 0),
        visible.value.length - 1
      )

const onKeydown = (event: KeyboardEvent): void => {
  if (event.metaKey || event.ctrlKey || event.altKey)
    return
  const step = STEPS[event.key]
  if (step) snap(stepFrom(step))
  else if (event.key === 'Escape' && tip.value) hide()
  else return
  event.preventDefault()
  // Keeps the date header's ← → shortcuts out of it.
  event.stopPropagation()
}

const ids = {
  clip: useId(),
  fill: useId(),
  glow: useId(),
  under: useId()
}
const url = (id: string): string => `url(#${id})`

// Keeps the notices clear of the axis labels.
const insets = {
  '--pad-bottom': `${PAD.bottom}px`,
  '--pad-left': `${PAD.left}px`
}
</script>

<template>
  <div ref="root" class="weight-chart" :style="insets">
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
      <line
        v-for="tick in grid"
        :key="tick.kg"
        class="grid"
        :x1="plot.left"
        :x2="plot.right - GRID_INSET"
        :y1="tick.y"
        :y2="tick.y"
      />
      <text
        v-for="month in months"
        :key="month.key"
        class="month"
        :x="month.x"
        :y="plot.bottom + MONTH_GAP"
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
          :clip-path="dot ? undefined : url(ids.under)"
        />
        <path class="line" :d="curve.line" />
        <circle
          v-if="dot"
          class="dot"
          :cx="dot.cx"
          :cy="dot.cy"
          r="3"
        />
      </g>

      <line
        v-if="tip"
        class="cursor"
        :x1="tip.left"
        :x2="tip.left"
        :y1="plot.top"
        :y2="tip.y"
      />
    </svg>

    <!-- Kept mounted, so screen readers announce it -->
    <p
      v-show="tip"
      class="tooltip"
      :class="{ '-flipped': tip?.flipped }"
      role="status"
      :style="tip && {
        left: `${tip.left}px`,
        top: `${tip.top}px`
      }"
    >
      {{ tip?.text }}
    </p>

    <p v-if="failed" class="notice" role="alert">
      Couldn't load your weight
    </p>
    <p v-else-if="empty" class="notice">
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

  // Clipped, but with room for the focus ring, which
  // sits just outside: clear of the month labels and
  // the header.
  overflow: clip;
  overflow-clip-margin: 3px;

  > .plot {
    display: block;
    border-radius: $radius-small;
    @include focus-ring;

    &:focus-visible { outline-offset: 1px; }
  }

  > .plot > .tick,
  > .plot > .month {
    font-size: rem(10px);
    font-weight: 700;
    text-transform: uppercase;
    fill: var(--color-widget-title);
  }

  // Centred on their y, as Figma centres them.
  > .plot > .tick,
  > .plot > .month { dominant-baseline: central; }

  // Figma's dashes, fainter at the top tick.
  > .plot > .grid {
    stroke: color-mix(
      in sRGB,
      var(--color-text) 5%,
      transparent
    );
    stroke-dasharray: 3 3;
    stroke-width: 0.5;

    &:first-of-type { opacity: 0.5; }
  }

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

  .dot {
    fill: var(--color-text-muted);
  }

  .line {
    fill: none;
    stroke: var(--color-text-muted);
    stroke-width: 1.5;
  }

  .cursor {
    stroke: var(--color-text-muted);
    stroke-dasharray: 4 3;
    stroke-width: 1;
  }

  // Beside the Entry, as in Figma.
  > .tooltip {
    position: absolute;
    z-index: 1;
    padding: space(1) space(2);
    font-size: rem(11px);
    white-space: nowrap;
    color: var(--color-text);
    pointer-events: none;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: $radius-small;
    transform: translate(#{space(2)}, -50%);

    &.-flipped {
      transform:
        translate(calc(-100% - #{space(2)}), -50%);
    }
  }

  > .notice {
    position: absolute;
    inset: 0 0 var(--pad-bottom) var(--pad-left);
    display: grid;
    place-items: center;
    font-size: rem(12px);
    color: var(--color-text-muted);
    pointer-events: none;
  }
}
</style>
