<script setup lang="ts">
// The Month Pace Widget's running-total chart: cumulative
// Expenses through the Selected Date as a glowing linear
// path with an area fill, against the even Budget pace
// line and month-end projection.
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useId
} from 'vue'
import { scaleLinear } from 'd3-scale'
import { area, curveLinear, line } from 'd3-shape'
import { formatAmount } from '@/expenses/money'
import type {
  MonthPace,
  MonthPaceDay
} from '@/expenses/month-pace'
import {
  dayFraction,
  formatAxisMoney,
  largeExpenseLabel,
  yScale
} from '@/expenses/month-pace-chart'
import { formatDate } from '@/locale/format'

const props = defineProps<{
  /** The month's spend, pace and projection. */
  pace: MonthPace
  /** The Selected Date, whose day ends the Spent line. */
  selectedDate: Date
  /** Whether `selectedDate` is today. */
  isToday: boolean
}>()

// Plot margins matching Figma's Month Pace frame (634×308
// plot inside 720×340), aligned with MonthPaceBars.
const PAD = { top: 18, right: 20, bottom: 14, left: 66 }
const TICK_X = 14
const TIP_CLEARANCE = 30

const root = ref<HTMLElement>()
const size = ref({ width: 720, height: 340 })
let observer: ResizeObserver | undefined

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(([{ contentRect }]) => {
    if (contentRect.width > 0 && contentRect.height > 0) {
      size.value = {
        width: contentRect.width,
        height: contentRect.height
      }
    }
  })
  observer.observe(root.value!)
})

onBeforeUnmount(() => observer?.disconnect())

const clamp = (
  value: number,
  min: number,
  max: number
): number => Math.min(Math.max(value, min), max)

const plot = computed(() => ({
  left: PAD.left,
  right: Math.max(PAD.left + 1, size.value.width - PAD.right),
  top: PAD.top,
  bottom: Math.max(PAD.top + 1, size.value.height - PAD.bottom)
}))

const scale = computed(() => yScale(props.pace))
const y = computed(() =>
  scaleLinear()
    .domain([0, scale.value.top])
    .range([plot.value.bottom, plot.value.top])
)

const xOf = (day: number): number =>
  plot.value.left
  + dayFraction(day, props.pace.days.length)
  * (plot.value.right - plot.value.left)

const ticks = computed(() =>
  scale.value.ticks.map(amount => ({
    amount,
    label: formatAxisMoney(amount),
    y: y.value(amount)
  }))
)

const elapsed = computed(() =>
  props.pace.days.filter(d => d.elapsed)
)
const current = computed(() => elapsed.value.at(-1))

const spent = computed(() => {
  const pts = elapsed.value
  const px = (d: MonthPaceDay): number => xOf(d.day)
  const py = (d: MonthPaceDay): number => y.value(d.total ?? 0)
  return {
    area: area<MonthPaceDay>(px, plot.value.bottom, py)
      .curve(curveLinear)(pts) ?? '',
    line: line<MonthPaceDay>(px, py)
      .curve(curveLinear)(pts) ?? ''
  }
})

const budget = computed(() => {
  const paceLine = props.pace.pace
  if (!paceLine) return null
  const y2 = y.value(paceLine.end.amount)
  return {
    x1: xOf(paceLine.start.day),
    y1: y.value(paceLine.start.amount),
    x2: xOf(paceLine.end.day),
    y2,
    labelX: plot.value.right,
    labelY: clamp(y2 - 6, 10, plot.value.bottom - 4)
  }
})

const projection = computed(() => {
  if (props.pace.daysLeft === 0 || !current.value) return null
  const y2 = y.value(props.pace.projection)
  return {
    x1: xOf(current.value.day),
    y1: y.value(props.pace.spent),
    x2: xOf(props.pace.days.length),
    y2,
    label: formatAmount(Math.round(props.pace.projection)),
    labelX: plot.value.right,
    labelY: clamp(
      y2 - 12,
      plot.value.top + 10,
      plot.value.bottom - 8
    )
  }
})

const marker = computed(() => {
  if (!current.value) return null
  const cx = xOf(current.value.day)
  const cy = y.value(props.pace.spent)
  const prefix = props.isToday
    ? 'Today'
    : formatDate(props.selectedDate, 'short')
  const text = `${prefix} · ${formatAmount(props.pace.spent)}`
  const need = Math.max(130, text.length * 6.5 + 26)
  const leftRoom = cx - plot.value.left
  const rightRoom = plot.value.right - cx
  return {
    cx,
    cy,
    text,
    tipTop: Math.max(TIP_CLEARANCE, cy),
    flipped: leftRoom < need && rightRoom > leftRoom
  }
})

const largeLabels = computed(() => {
  const { left, right, top, bottom } = plot.value
  return elapsed.value.flatMap(d => {
    const text = largeExpenseLabel(d.largeExpenses)
    if (!text) return []
    const px = xOf(d.day)
    const py = y.value(d.total ?? 0)
    const fitsRight = px + 6 + text.length * 6 <= right
    return [{
      day: d.day,
      text,
      x: fitsRight ? px + 6 : Math.max(left + 4, px - 6),
      y: clamp(py + 12.5, top + 6, bottom - 6),
      anchor: fitsRight ? 'start' : 'end'
    }]
  })
})

const ariaLabel = computed(() => {
  const parts = [
    `Month pace chart: ${formatAmount(props.pace.spent)} spent`
  ]
  if (props.pace.daysLeft > 0) {
    const projected = formatAmount(
      Math.round(props.pace.projection)
    )
    parts.push(`projected ${projected}`)
  }
  if (props.pace.pace) {
    const limit = formatAmount(props.pace.pace.end.amount)
    parts.push(`budget ${limit}`)
  }
  return parts.join(', ')
})

const ids = {
  area: useId(),
  lineGlow: useId(),
  dotGlow: useId()
}
const glows = [
  { id: ids.lineGlow, std: 3, cls: 'line-glow' },
  { id: ids.dotGlow, std: 4, cls: 'dot-glow' }
] as const
const url = (id: string): string => `url(#${id})`
</script>

<template>
  <div ref="root" class="month-pace-chart">
    <svg
      class="plot"
      :width="size.width"
      :height="size.height"
      role="img"
      :aria-label="ariaLabel"
    >
      <defs>
        <linearGradient :id="ids.area" x1="0" y1="0" x2="0" y2="1">
          <stop class="area-top" offset="0" />
          <stop class="area-bottom" offset="1" />
        </linearGradient>
        <filter
          v-for="glow in glows"
          :id="glow.id"
          :key="glow.id"
          filterUnits="userSpaceOnUse"
          x="0"
          y="0"
          :width="size.width"
          :height="size.height"
          color-interpolation-filters="sRGB"
        >
          <feDropShadow
            :class="glow.cls"
            dx="0"
            dy="0"
            :stdDeviation="glow.std"
          />
        </filter>
      </defs>

      <line
        v-for="tick in ticks"
        :key="`grid-${tick.amount}`"
        class="grid"
        :x1="plot.left"
        :x2="plot.right"
        :y1="tick.y"
        :y2="tick.y"
      />
      <text
        v-for="tick in ticks"
        :key="`tick-${tick.amount}`"
        class="tick"
        :x="TICK_X"
        :y="tick.y"
      >
        {{ tick.label }}
      </text>

      <line
        v-if="budget"
        class="budget-line"
        :x1="budget.x1"
        :y1="budget.y1"
        :x2="budget.x2"
        :y2="budget.y2"
      />
      <text
        v-if="budget"
        class="budget-label"
        :x="budget.labelX"
        :y="budget.labelY"
      >
        Budget
      </text>

      <path
        v-if="spent.area"
        class="spent-area"
        :d="spent.area"
        :fill="url(ids.area)"
      />
      <path
        v-if="spent.line"
        class="spent-line"
        :d="spent.line"
        :filter="url(ids.lineGlow)"
      />

      <line
        v-if="projection"
        class="projection-line"
        :x1="projection.x1"
        :y1="projection.y1"
        :x2="projection.x2"
        :y2="projection.y2"
      />
      <text
        v-if="projection"
        class="projection-label"
        :x="projection.labelX"
        :y="projection.labelY"
      >
        {{ projection.label }}
      </text>

      <line
        v-if="marker"
        class="marker"
        :x1="marker.cx"
        :x2="marker.cx"
        :y1="plot.top"
        :y2="plot.bottom"
      />
      <text
        v-for="item in largeLabels"
        :key="item.day"
        class="large-label"
        :x="item.x"
        :y="item.y"
        :text-anchor="item.anchor"
      >
        {{ item.text }}
      </text>
      <circle
        v-if="marker"
        class="dot"
        :cx="marker.cx"
        :cy="marker.cy"
        r="4"
        :filter="url(ids.dotGlow)"
      />
    </svg>

    <p
      v-if="marker"
      class="tooltip"
      :class="{ '-flipped': marker.flipped }"
      :style="{
        left: `${marker.cx}px`,
        top: `${marker.tipTop}px`
      }"
    >
      {{ marker.text }}
    </p>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.month-pace-chart {
  position: relative;
  width: 100%;
  height: 100%;

  > .plot { display: block; }

  > .plot > .grid {
    stroke: var(--color-month-pace-grid);
    stroke-width: 0.5;
  }

  > .plot > .tick {
    font-size: rem(10px);
    font-weight: 700;
    fill: var(--color-widget-title);
    dominant-baseline: central;
  }

  .area-top { stop-color: var(--color-month-pace-area); }

  .area-bottom {
    stop-color: var(--color-month-pace-area);
    stop-opacity: 0;
  }

  .line-glow {
    flood-color: var(--color-month-pace-line-glow);
  }

  .dot-glow {
    flood-color: var(--color-month-pace-dot-glow);
  }

  > .plot > .spent-line {
    fill: none;
    stroke: var(--color-month-pace-line);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.6;
  }

  > .plot > .budget-line {
    stroke: var(--color-month-pace-pace);
    stroke-dasharray: 4 4;
    stroke-width: 1;
  }

  > .plot > .budget-label,
  > .plot > .large-label {
    font-size: rem(9px);
    font-weight: 700;
    text-transform: uppercase;
    fill: var(--color-month-pace-label);
  }

  > .plot > .budget-label { text-anchor: end; }
  > .plot > .large-label { dominant-baseline: central; }

  > .plot > .projection-line {
    stroke: var(--color-month-pace-projection);
    stroke-dasharray: 1.5 4;
    stroke-linecap: round;
    stroke-width: 1.4;
  }

  > .plot > .projection-label {
    font-family: $font-family-mono;
    font-size: rem(10px);
    font-weight: 500;
    fill: var(--color-month-pace-figure);
    text-anchor: end;
    dominant-baseline: central;
  }

  > .plot > .marker {
    stroke: var(--color-month-pace-marker);
    stroke-dasharray: 2 3;
    stroke-width: 1;
  }

  > .plot > .dot { fill: var(--color-month-pace-dot); }

  > .tooltip {
    position: absolute;
    display: flex;
    align-items: center;
    height: rem(22px);
    padding: 0 rem(8px);
    font-size: rem(10px);
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--color-month-pace-tip-text);
    pointer-events: none;
    background: var(--color-month-pace-tip);
    border-radius: rem(5px);
    transform: translate(
      calc(-100% - #{rem(10px)}),
      calc(-100% - #{rem(8px)})
    );

    &.-flipped {
      transform: translate(
        rem(10px),
        calc(-100% - #{rem(8px)})
      );
    }
  }
}
</style>
