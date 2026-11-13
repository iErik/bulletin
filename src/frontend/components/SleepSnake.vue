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
  pointAt,
  ROW_GAP,
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
// that crosses its midnight ends.
const height = computed(() =>
  2 * SNAKE_TOP + props.days * 2 * ROW_GAP)

/** A dotted line along every AM and PM row. */
const track = computed(() => {
  const { top, gap } = layout.value
  const lines: string[] = []
  for (let day = 0; day < props.days; day++) {
    const y = top + 2 * gap * day
    lines.push(`M 0 ${y} H ${width.value}`)
    lines.push(`M 0 ${y + gap} H ${width.value}`)
  }
  return lines.join(' ')
})

const draw = (stretch: Stretch): {
  path: string
  span: { left: number; right: number }
  head: { x: number; y: number }
  tail: { x: number; y: number }
} => {
  const { start, end } = stretch
  const { first } = props
  return {
    path: stretchPath(start, end, first, layout.value),
    span: stretchSpan(start, end, first, layout.value),
    head: pointAt(start, first, layout.value),
    tail: pointAt(end, first, layout.value)
  }
}

const drawn = computed(() => width.value > 0
  ? props.periods.map(period => ({
      period,
      ...draw(period)
    }))
  : [])

const previewed = computed(() =>
  props.preview && width.value > 0
    ? draw(props.preview)
    : null)

const chip = computed(() => props.hover && width.value > 0
  ? {
      text: props.hover.text,
      ...pointAt(props.hover.time, props.first, layout.value)
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
  const time = timeAt(
    { x: event.clientX - box.left, y: event.clientY - box.top },
    props.first,
    layout.value
  )
  const { from, to } = range.value
  return Math.min(to, Math.max(from, time))
}

const gradient = (period: number | 'preview'): string =>
  `${id}-line-${period}`

/** A gradient's ends: at least 1 px apart, to show. */
const across = (span: { left: number; right: number }): {
  x1: number
  x2: number
} => ({ x1: span.left, x2: Math.max(span.right, span.left + 1) })

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
        <!-- Figma's "Zooommm" effect on the end circles. -->
        <filter
          :id="`${id}-end`"
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
            result="b1"
          />
          <feFlood class="glow" flood-opacity="0.12" />
          <feComposite in2="b1" operator="in" result="s1" />
          <feGaussianBlur
            in="SourceAlpha"
            stdDeviation="4.6"
            result="b2"
          />
          <feFlood class="glow" flood-opacity="0.82" />
          <feComposite in2="b2" operator="in" result="s2" />
          <feOffset in="SourceAlpha" dy="2" result="o3" />
          <feGaussianBlur
            in="o3"
            stdDeviation="2.5"
            result="b3"
          />
          <feFlood class="tint" flood-opacity="0.35" />
          <feComposite in2="b3" operator="in" result="s3" />
          <feGaussianBlur
            in="SourceAlpha"
            stdDeviation="8.75"
            result="b4"
          />
          <feFlood class="glow" flood-opacity="0.38" />
          <feComposite in2="b4" operator="in" result="s4" />
          <feMerge>
            <feMergeNode in="s1" />
            <feMergeNode in="s2" />
            <feMergeNode in="s3" />
            <feMergeNode in="s4" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
          <feGaussianBlur stdDeviation="1.75" />
        </filter>
        <!-- Each line's gradient runs left to right. -->
        <linearGradient
          v-for="line in drawn"
          :id="gradient(line.period.id)"
          :key="line.period.id"
          gradientUnits="userSpaceOnUse"
          v-bind="across(line.span)"
        >
          <stop class="from" />
          <stop class="to" offset="1" />
        </linearGradient>
        <linearGradient
          v-if="previewed"
          :id="gradient('preview')"
          gradientUnits="userSpaceOnUse"
          v-bind="across(previewed.span)"
        >
          <stop class="from" />
          <stop class="to" offset="1" />
        </linearGradient>
      </defs>
      <path class="track" :d="track" />
      <g
        v-for="line in drawn"
        :key="line.period.id"
        class="period"
        :class="{ '-editing': editing === line.period.id }"
        :data-period="line.period.id"
      >
        <path
          class="line"
          :d="line.path"
          :stroke="`url(#${gradient(line.period.id)})`"
        />
        <circle
          v-for="end in (['start', 'end'] as const)"
          :key="end"
          class="end"
          :class="`-${end}`"
          :cx="end === 'start' ? line.head.x : line.tail.x"
          :cy="end === 'start' ? line.head.y : line.tail.y"
          r="3.5"
          :filter="`url(#${id}-end)`"
        />
        <!-- Wider targets for dragging an end. -->
        <circle
          v-for="end in (['start', 'end'] as const)"
          :key="`handle-${end}`"
          class="handle"
          :class="`-${end}`"
          :cx="end === 'start' ? line.head.x : line.tail.x"
          :cy="end === 'start' ? line.head.y : line.tail.y"
          r="7"
          @pointerdown.stop="emit('grab', line.period, end)"
        />
      </g>
      <g
        v-if="previewed"
        class="period -preview"
        :class="{ '-broken': broken }"
      >
        <path
          class="line"
          :d="previewed.path"
          :stroke="`url(#${gradient('preview')})`"
        />
        <circle
          v-for="(end, i) in [previewed.head, previewed.tail]"
          :key="i"
          class="end"
          :cx="end.x"
          :cy="end.y"
          r="3.5"
          :filter="`url(#${id}-end)`"
        />
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

  // Figma's "Zammm" effect on the line.
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
    --color-sleep-end: var(--color-danger);
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
