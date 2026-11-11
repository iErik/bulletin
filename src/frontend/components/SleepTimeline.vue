<script setup lang="ts">
// The Sleep Widget's body: one Timeline row per day
// (ADR 0002), oldest first, with the rest of the
// current month dimmed below today. Months load as the
// list nears either edge, and the Selected Date's row
// scrolls to the centre whenever it changes. Scrolling
// never changes the Selected Date.
//
// Creating a Period takes two clicks on empty parts of
// the Timeline: the first sets the Head, then a preview
// follows the pointer, and the second sets the Tail.
// Escape or a click outside the Widget cancels.
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import { addDays, isAfter, isSameDay } from 'date-fns'
import type {
  EpochMs,
  NewSleepPeriod,
  SleepPeriod
} from '@shared/sleep'
import { localDate } from '@shared/dates'
import { formatDate, formatTime } from '@/locale/format'
import { caption } from '@/sleep/caption'
import {
  breaks,
  ordered,
  periodAt,
  reason,
  snap
} from '@/sleep/selection'
import {
  axisTicks,
  rowOf,
  segmentsOf,
  toFraction,
  toTime
} from '@/sleep/timeline'
import { useSleepMonths } from '@/sleep/use-sleep-months'
import { useSelectedDateStore }
  from '@/stores/selected-date'

const store = useSelectedDateStore()
const months = useSleepMonths(() => store.today)
const scroller = useTemplateRef<HTMLElement>('scroller')
const root = useTemplateRef<HTMLElement>('root')

/** The snapped time under the pointer, and its row. */
const pointer = shallowRef<{
  key: string
  time: EpochMs
} | null>(null)
/** The first click's time, while selecting. */
const head = ref<EpochMs | null>(null)
/** Why the last click was refused, until it moves. */
const refusal = ref<string | null>(null)
const saveError = ref<string | null>(null)
const saving = ref(false)

/** The Period the selection would create. */
const preview = computed(() =>
  head.value !== null && pointer.value
    ? ordered(head.value, pointer.value.time)
    : null
)

const broken = computed(() =>
  preview.value
  && breaks(preview.value, months.periods.value,
    Date.now()))

// Each row's own Periods, by the row of their Head.
const byRow = computed(() => {
  const rows = new Map<string, SleepPeriod[]>()
  for (const period of months.periods.value) {
    const key = localDate(rowOf(period.start))
    rows.set(key, [...rows.get(key) ?? [], period])
  }
  return rows
})

const rows = computed(() =>
  months.days.value.map(day => {
    const key = localDate(day)
    const own = byRow.value.get(key) ?? []
    const before = byRow.value
      .get(localDate(addDays(day, -1))) ?? []
    return {
      key,
      day,
      label: formatDate(day, 'short'),
      caption: caption(own),
      segments: segmentsOf([...before, ...own], day),
      preview: preview.value
        ? segmentsOf([{ id: 0, ...preview.value }], day)
        : [],
      hover: hoverOn(key, day),
      future: isAfter(day, store.today),
      selected: isSameDay(day, store.day)
    }
  })
)

/**
 * The time tooltip on `key`'s row: the pointer's time,
 * or why its click was refused. None over a Period
 * unless selecting, as that's not an empty part.
 */
function hoverOn(
  key: string,
  day: Date
): { fraction: number; text: string } | null {
  const at = pointer.value
  if (at?.key !== key) return null
  if (head.value === null
    && periodAt(months.periods.value, at.time))
    return null
  return {
    fraction: toFraction(at.time, day),
    text: refusal.value ?? formatTime(new Date(at.time))
  }
}

/** The snapped time under the pointer on `day`'s row. */
const timeAt = (event: MouseEvent, day: Date): EpochMs => {
  const track = event.currentTarget as HTMLElement
  const box = track.getBoundingClientRect()
  const x = (event.clientX - box.left) / box.width
  return snap(toTime(Math.min(1, Math.max(0, x)), day))
}

const onMove = (
  event: MouseEvent,
  day: Date,
  key: string
): void => {
  const time = timeAt(event, day)
  if (pointer.value?.time !== time) refusal.value = null
  pointer.value = { key, time }
}

// While selecting, the preview stays where the pointer
// left it, so moving between rows doesn't flicker.
const onLeave = (): void => {
  if (head.value === null) pointer.value = null
  refusal.value = null
}

const onClick = (event: MouseEvent, day: Date): void => {
  if (saving.value) return
  const time = timeAt(event, day)
  if (head.value === null) {
    if (periodAt(months.periods.value, time)) return
    if (time > Date.now()) {
      refusal.value = reason('future-date')
      return
    }
    saveError.value = null
    head.value = time
    return
  }
  const period = ordered(head.value, time)
  const rule = breaks(period, months.periods.value,
    Date.now())
  if (rule) refusal.value = reason(rule)
  else void save(period)
}

const save = async (
  period: NewSleepPeriod
): Promise<void> => {
  cancel()
  saving.value = true
  const result = await window.bulletin.sleep.create(period)
  saving.value = false
  if (result.ok) months.add(result.value)
  else {
    saveError.value = "Couldn't save the period. "
      + `${reason(result.error.code)}.`
  }
}

const cancel = (): void => {
  head.value = null
  pointer.value = null
  refusal.value = null
}

const onKeydown = (event: Event): void => {
  if ((event as KeyboardEvent).key === 'Escape') cancel()
}

// The Head's own click is inside, so it never cancels.
const onDocumentClick = (event: Event): void => {
  const widget = root.value?.closest('.widget-frame')
    ?? root.value
  if (widget && !event.composedPath().includes(widget))
    cancel()
}

const listen = (on: boolean): void => {
  const method = on
    ? 'addEventListener'
    : 'removeEventListener'
  window[method]('keydown', onKeydown)
  document[method]('click', onDocumentClick)
}

watch(() => head.value !== null, listen)
onBeforeUnmount(() => listen(false))

const ticks = axisTicks().map(tick => ({
  ...tick,
  label: formatTime(new Date(tick.time))
}))

const percent = (fraction: number): string =>
  `${fraction * 100}%`

/** Scrolls the Selected Date's row to the centre. */
const centre = (): void => {
  const list = scroller.value
  const row = list?.querySelector<HTMLElement>(
    `[data-day="${localDate(store.day)}"]`
  )
  if (!list || !row) return
  list.scrollTop = row.offsetTop
    - (list.clientHeight - row.offsetHeight) / 2
}

// Loads one month when within half a view of an edge.
// Rows added above push the content down by exactly
// their height, so the scroll position follows it.
let loading = false
const loadNearEdges = async (): Promise<void> => {
  const list = scroller.value
  if (!list || loading) return
  const edge = list.clientHeight / 2
  const below = list.scrollHeight - list.scrollTop
    - list.clientHeight
  loading = true
  try {
    if (list.scrollTop < edge) {
      const height = list.scrollHeight
      if (await months.loadEarlier()) {
        await nextTick()
        list.scrollTop += list.scrollHeight - height
      }
    } else if (below < edge)
      await months.loadLater()
  } finally {
    loading = false
  }
}

const follow = async (day: Date): Promise<void> => {
  if (!months.contains(day)) await months.reset(day)
  await nextTick()
  centre()
}

onMounted(() => follow(store.day))
watch(() => store.day, follow)

// A new month at midnight: a past Selected Date stays
// put, so today's month is added here instead.
watch(() => store.today, today => {
  if (store.isToday || months.contains(today)) return
  if (months.contains(addDays(today, -1)))
    void months.loadLater()
})
</script>

<template>
  <div ref="root" class="sleep-timeline">
    <p v-if="months.failed.value" class="error" role="alert">
      Couldn't load sleep.
    </p>
    <p v-if="saveError" class="error" role="alert">
      {{ saveError }}
    </p>
    <ol
      ref="scroller"
      class="rows"
      @scroll.passive="loadNearEdges"
    >
      <li
        v-for="row in rows"
        :key="row.key"
        class="day-row"
        :class="{
          '-future': row.future,
          '-selected': row.selected
        }"
        :data-day="row.key"
        :aria-disabled="row.future || undefined"
      >
        <div class="label">
          <span class="date">{{ row.label }}</span>
          <span v-if="row.caption" class="caption">
            {{ row.caption }}
          </span>
        </div>
        <div
          class="track"
          @pointermove="onMove($event, row.day, row.key)"
          @pointerleave="onLeave"
          @click="onClick($event, row.day)"
        >
          <div
            v-for="segment in row.segments"
            :key="segment.period.id"
            class="period"
            :class="{
              '-head': segment.head,
              '-tail': segment.tail
            }"
            :style="{
              left: percent(segment.from),
              width: percent(segment.to - segment.from)
            }"
          />
          <div
            v-for="(segment, i) in row.preview"
            :key="`preview-${i}`"
            class="period -preview"
            :class="{
              '-head': segment.head,
              '-tail': segment.tail,
              '-broken': broken
            }"
            :style="{
              left: percent(segment.from),
              width: percent(segment.to - segment.from)
            }"
          />
          <span
            v-if="row.hover"
            class="hover"
            aria-hidden="true"
            :style="{ left: percent(row.hover.fraction) }"
          >
            {{ row.hover.text }}
          </span>
        </div>
      </li>
    </ol>
    <div class="axis" aria-hidden="true">
      <div class="track">
        <span
          v-for="tick in ticks"
          :key="tick.fraction"
          class="tick"
          :style="{ left: percent(tick.fraction) }"
        >
          {{ tick.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// The label column and the track's inset, shared by
// the rows and the axis so their times line up.
$label-width: rem(112px);
$track-inset: space(6);
$dot: rem(7px);

@mixin columns {
  display: grid;
  grid-template-columns: $label-width 1fr;

  > .track {
    position: relative;
    grid-column: 2;
    margin: 0 $track-inset;
  }
}

@mixin glow {
  background: var(--color-text);
  box-shadow: 0 0 rem(6px) var(--color-text);
}

.sleep-timeline {
  display: flex;
  flex-direction: column;
  height: 100%;

  > .error {
    font-size: rem(12px);
    color: var(--color-text-muted);
  }

  > .rows {
    position: relative; // Rows' offsetTop is from here
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-anchor: none; // We keep the position
    scrollbar-gutter: stable;
  }

  // The same gutter as the rows' scrollbar, so the
  // ticks line up where scrollbars take up space.
  > .axis {
    @include columns;

    overflow-y: hidden;
    scrollbar-gutter: stable;
    padding-top: space(2);
    font-size: rem(11px);
    color: var(--color-text-muted);
  }

  > .axis > .track {
    height: space(5);
    border-top: 1px dotted var(--color-border);
  }

  > .axis > .track > .tick {
    position: absolute;
    top: space(1);
    white-space: nowrap;
    transform: translateX(-50%);
  }
}

.day-row {
  @include columns;

  align-items: center;
  min-height: rem(52px);

  > .label {
    display: flex;
    flex-direction: column;
    font-size: rem(14px);
    color: var(--color-text-muted);
  }

  > .label > .caption {
    font-size: rem(10px);
  }

  > .track {
    height: 0;
    cursor: crosshair;
    border-top: 1px dotted var(--color-border);
  }

  // The track is a line: this widens where it takes
  // the pointer, and its events land on the track.
  > .track::before {
    position: absolute;
    inset: rem(-12px) 0 auto;
    height: rem(24px);
    content: '';
  }

  // The time under the pointer, above the line, in
  // inverted colours like the app's tooltips.
  > .track > .hover {
    position: absolute;
    bottom: space(2);
    z-index: 1;
    padding: space(1) space(2);
    font-size: rem(12px);
    white-space: nowrap;
    color: var(--color-surface);
    background: var(--color-text);
    border-radius: $radius-small;
    transform: translateX(-50%);
    pointer-events: none;
  }

  // Centred on the dotted line above the track's box.
  > .track > .period {
    position: absolute;
    top: -0.5px;
    height: 2px;
    border-radius: 1px;
    transform: translateY(-50%);
    @include glow;
  }

  // The Head and Tail circles.
  > .track > .period.-head::before,
  > .track > .period.-tail::after {
    position: absolute;
    top: 50%;
    width: $dot;
    height: $dot;
    content: '';
    border-radius: 50%;
    @include glow;
  }

  > .track > .period.-head::before {
    left: 0;
    transform: translate(-50%, -50%);
  }

  > .track > .period.-tail::after {
    right: 0;
    transform: translate(50%, -50%);
  }

  > .track > .period.-preview {
    opacity: 0.7;
    pointer-events: none;
  }

  // The glow, Head and Tail all take it from here.
  > .track > .period.-broken {
    --color-text: var(--color-danger);
  }

  &.-selected > .label {
    color: var(--color-text);
  }

  // The rest of the month: shown, but not usable.
  &.-future {
    pointer-events: none;
    opacity: 0.35;
  }
}
</style>
