<script setup lang="ts">
// The Sleep Timeline drawn as Figma's snake (ADR 0003),
// for `days` days from `first`: dotted rows, each
// Period as a glowing stretch from its Head to its Tail
// with a circle at each end, the selection's preview,
// and a time chip on the snake. It knows no rules: it
// reports the time under the pointer, clicks, and
// presses on a Period's ends, and its parent decides
// what they do.
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  useTemplateRef
} from 'vue'
import { addDays, startOfDay } from 'date-fns'
import type { EpochMs, SleepPeriod } from '@shared/sleep'
import type { End } from '@/sleep/selection'
import {
  type Point,
  pointAt,
  ROW_GAP,
  SNAKE_EDGE,
  SNAKE_TOP,
  snakeLayout,
  stretchPath,
  stretchSpan,
  timeAt
} from '@/sleep/snake'

interface Stretch {
  readonly start: EpochMs
  readonly end: EpochMs
}

const props = defineProps<{
  first: Date
  days: number
  periods: readonly SleepPeriod[]
  /** The Period a selection would create. */
  preview?: Stretch | null
  /** Whether the preview breaks a rule. */
  broken?: boolean
  /** The id of the Period whose tooltip is open. */
  editing?: number | null
  /** A time to show on the snake, and its text. */
  hover?: { time: EpochMs; text: string } | null
}>()

const emit = defineEmits<{
  /** The time under the pointer, or null once it leaves. */
  point: [time: EpochMs | null]
  press: [time: EpochMs]
  grab: [period: SleepPeriod, end: End]
}>()

const id = useId()
const svg = useTemplateRef<SVGSVGElement>('svg')
const width = ref(0)

const layout = computed(() => snakeLayout(width.value))

// Room for the day after the last too, where a Period
// that crosses its midnight ends: as late as its PM row.
const height = computed(() =>
  2 * SNAKE_TOP + (2 * props.days + 1) * ROW_GAP)

/**
 * A dotted line along every AM and PM row, the day
 * after the last's too, out to the curves' edges.
 */
const track = computed(() => {
  const { top, gap } = layout.value
  const to = width.value - SNAKE_EDGE
  const lines: string[] = []
  const last = top + (2 * props.days + 1) * gap
  for (let y = top; y <= last; y += gap)
    lines.push(`M ${SNAKE_EDGE} ${y} H ${to}`)
  return lines.join(' ')
})

/** A drawn stretch: a Period, or the preview. */
interface Drawn {
  readonly key: string
  readonly period?: SleepPeriod
  readonly path: string
  /** Where its gradient starts and ends. */
  readonly x1: number
  readonly x2: number
  readonly ends: readonly { end: End; at: Point }[]
}

/**
 * Draws `stretch`. Its gradient runs across its span
 * from the Head's side to the Tail's, at least 1 px.
 */
const draw = (key: string, stretch: Stretch): Drawn => {
  const { start, end } = stretch
  const { first } = props
  const at = layout.value
  const head = pointAt(start, first, at)
  const tail = pointAt(end, first, at)
  const { left, right } = stretchSpan(start, end, first, at)
  const [x1, x2] = head.x <= tail.x
    ? [left, Math.max(right, left + 1)]
    : [right, Math.min(left, right - 1)]
  return {
    key,
    path: stretchPath(start, end, first, at),
    x1,
    x2,
    ends: [
      { end: 'start', at: head },
      { end: 'end', at: tail }
    ]
  }
}

/** The Periods, then the preview over them. */
const drawn = computed((): Drawn[] => {
  if (width.value === 0) return []
  const periods = props.periods.map(period => ({
    ...draw(`period-${period.id}`, period),
    period
  }))
  return props.preview
    ? [...periods, draw('preview', props.preview)]
    : periods
})

const chip = computed(() => props.hover && width.value > 0
  ? {
      text: props.hover.text,
      ...pointAt(
        props.hover.time,
        props.first,
        layout.value
      )
    }
  : null)

/** The times the snake draws, for clamping a click. */
const range = computed(() => {
  const first = startOfDay(props.first)
  return {
    from: first.getTime(),
    to: addDays(first, props.days + 1).getTime()
  }
})

const timeOf = (event: MouseEvent): EpochMs => {
  const box = svg.value!.getBoundingClientRect()
  const point = {
    x: event.clientX - box.left,
    y: event.clientY - box.top
  }
  const time = timeAt(point, props.first, layout.value)
  const { from, to } = range.value
  return Math.min(to, Math.max(from, time))
}

/** An element id in this snake. */
const elementId = (name: string): string => `${id}-${name}`

const px = (n: number): string => `${n}px`

let observer: ResizeObserver | undefined

onMounted(() => {
  const el = svg.value
  if (!el) return
  const measure = (): void => {
    width.value = el.getBoundingClientRect().width
  }
  measure()
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(measure)
  observer.observe(el)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="sleep-snake">
    <svg
      ref="svg"
      class="canvas"
      :height="height"
      @pointermove="emit('point', timeOf($event))"
      @pointerleave="emit('point', null)"
      @click="emit('press', timeOf($event))"
    >
      <defs>
        <!--
          Figma's "Zooommm" effect on the end circles, as
          Figma exports it: each shadow's blur radius is
          twice its stdDeviation, and the last blur
          softens the whole stack.
        -->
        <filter
          :id="elementId('end')"
          x="-400%"
          y="-400%"
          width="900%"
          height="900%"
          color-interpolation-filters="sRGB"
        >
          <feMorphology
            in="SourceAlpha"
            operator="dilate"
            radius="7"
            result="spread"
          />
          <feGaussianBlur
            in="spread"
            stdDeviation="6.7"
            result="spread-blur"
          />
          <feFlood class="glow" flood-opacity="0.12" />
          <feComposite
            in2="spread-blur"
            operator="in"
            result="spread-glow"
          />
          <feGaussianBlur
            in="SourceAlpha"
            stdDeviation="4.6"
            result="near-blur"
          />
          <feFlood class="glow" flood-opacity="0.82" />
          <feComposite
            in2="near-blur"
            operator="in"
            result="near-glow"
          />
          <feOffset
            in="SourceAlpha"
            dy="2"
            result="tint-offset"
          />
          <feGaussianBlur
            in="tint-offset"
            stdDeviation="2.5"
            result="tint-blur"
          />
          <feFlood class="tint" flood-opacity="0.35" />
          <feComposite
            in2="tint-blur"
            operator="in"
            result="tint-glow"
          />
          <feGaussianBlur
            in="SourceAlpha"
            stdDeviation="8.75"
            result="far-blur"
          />
          <feFlood class="glow" flood-opacity="0.38" />
          <feComposite
            in2="far-blur"
            operator="in"
            result="far-glow"
          />
          <feMerge>
            <feMergeNode in="spread-glow" />
            <feMergeNode in="near-glow" />
            <feMergeNode in="tint-glow" />
            <feMergeNode in="far-glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
          <feGaussianBlur stdDeviation="1.75" />
        </filter>
        <linearGradient
          v-for="line in drawn"
          :id="elementId(line.key)"
          :key="line.key"
          gradientUnits="userSpaceOnUse"
          :x1="line.x1"
          :x2="line.x2"
        >
          <stop class="from" />
          <stop class="to" offset="1" />
        </linearGradient>
      </defs>
      <path class="track" :d="track" />
      <g
        v-for="line in drawn"
        :key="line.key"
        class="period"
        :class="line.period ? {
          '-editing': editing === line.period.id
        } : ['-preview', { '-broken': broken }]"
        :data-period="line.period?.id"
      >
        <path
          class="line"
          :d="line.path"
          :stroke="`url(#${elementId(line.key)})`"
        />
        <circle
          v-for="{ end, at } in line.ends"
          :key="end"
          class="end"
          :class="`-${end}`"
          :cx="at.x"
          :cy="at.y"
          r="3.5"
          :filter="`url(#${elementId('end')})`"
        />
        <!-- Wider targets for dragging an end. -->
        <template v-if="line.period">
          <circle
            v-for="{ end, at } in line.ends"
            :key="`handle-${end}`"
            class="handle"
            :class="`-${end}`"
            :cx="at.x"
            :cy="at.y"
            r="7"
            @pointerdown.stop="
              emit('grab', line.period, end)"
            @click.stop
          />
        </template>
      </g>
    </svg>
    <span
      v-if="chip"
      class="hover"
      aria-hidden="true"
      :style="{ left: px(chip.x), top: px(chip.y) }"
    >
      {{ chip.text }}
    </span>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.sleep-snake {
  position: relative;

  > .canvas {
    display: block;
    width: 100%;
    overflow: visible;
    cursor: crosshair;
  }

  .track {
    fill: none;
    stroke: var(--color-sleep-track);
    stroke-dasharray: 2 4;
  }

  .glow { flood-color: var(--color-sleep-end); }
  .tint { flood-color: var(--color-sleep-end-tint); }

  .from { stop-color: var(--color-sleep-line-from); }
  .to { stop-color: var(--color-sleep-line-to); }

  // Figma's "Zammm" effect on the line. CSS's
  // drop-shadow takes Figma's 10.3 blur radius as is,
  // and blur() a stdDeviation: half its 0.8.
  .period > .line {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: bevel;
    filter:
      drop-shadow(
        0 0 rem(10.3px)
        color-mix(
          in sRGB,
          var(--color-sleep-line-glow) 26%,
          transparent
        )
      )
      blur(0.4px);
  }

  .period > .end { fill: var(--color-sleep-end); }

  .period > .handle {
    cursor: ew-resize;
    fill: transparent;
  }

  // Highlighted while its tooltip is open.
  .period.-editing > .line { stroke-width: 3; }

  .period.-preview {
    opacity: 0.7;
    pointer-events: none;
  }

  // The line, its glow and its ends take it from here.
  .period.-broken {
    --color-sleep-line-from: var(--color-danger);
    --color-sleep-line-to: var(--color-danger);
    --color-sleep-line-glow: var(--color-danger);
    --color-sleep-end: var(--color-danger);
    --color-sleep-end-tint: var(--color-danger);
  }

  // The time on the snake, above it, in inverted
  // colours like the app's tooltips.
  > .hover {
    position: absolute;
    z-index: 1;
    padding: space(1) space(2);
    font-size: rem(12px);
    white-space: nowrap;
    color: var(--color-surface);
    background: var(--color-text);
    border-radius: $radius-small;
    transform: translate(-50%, calc(-100% - #{space(2)}));
    pointer-events: none;
  }
}
</style>
